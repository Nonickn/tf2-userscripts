// ==UserScript==
// @name         backpack.tf Quick Listing
// @namespace    http://steamcommunity.com/id/caresx/
// @version      1.0
// @description  Quickly list your items on backpack.tf Classifieds
// @author       cares
// @match        *://backpack.tf/profiles/*
// @grant        none
// ==/UserScript==

$(function () {
    var userId = $('a[href^="/logout"]').attr('href').replace(/(.*?=)/, ''),
        verified = false,
        cd = window.createDetails,
        values;
    var currencyNames = {
        long: {
            earbuds: l("bud buds"),
            keys: l("key keys"),
            metal: l("ref ref")
        },
        short: {
            earbuds: l("b b"),
            keys: l("k k"),
            metal: l("r r")
        }
    };
    var bppr = $('#backpack').closest('.panel').find('.pull-right');
    
    function l(str) {
        return str.split(" ");
    }
    
    function qlFormatValue(value, short) {
        var str = [],
            cnames = currencyNames[short ? "short" : "long"],
            space = short ? "" : " ";
        
        if (value.earbuds) str.push(value.earbuds + space + cnames.earbuds[+(value.earbuds !== 1)]);
        if (value.keys) str.push(value.keys + space + cnames.keys[+(value.keys !== 1)]);
        if (value.metal) str.push(value.metal + space + cnames.metal[+(value.metal !== 1)]);
        return str.join(', ');
    }
    
    function createDetails(item) {
        var d = cd(item),
            qs = $("<dd class='popover-btns'>");
        
        if (!item.data("can-sell") || item.data("listing-steamid")) {
            return d;
        }
        
        values.forEach(function (v, idx) {
            qs.append($('<a class="btn btn-default btn-xs quicklist" data-value-idx="' + idx + '"  data-id="' + item.data('id') + '"><i class="fa fa-tag"></i> ' + qlFormatValue(v, true) + '</a>'));
        });
        
        d.append(qs);
        return d;
    }
    
    function currentSelection() {
        return $('.item:not(.spacer,.unselected):visible').filter(function () {
            var item = $(this);
            return item.data("can-sell") && !item.data("listing-steamid");
        });
    }
    
    function findSample() {
        return $('[data-listing-offers-url]').first();
    }
    
    function listSelection(value) {
        var selection = currentSelection(),
            sample = findSample(),
            half = selection.length / 2;
        
        clearSelection();
        updateClearSelectionState();
        selection.each(function (idx) {
            if (idx >= half) return;
            listItem($(this).data('id'), value, sample);
        });
    }
    
    function listItem(id, value, sample) {
        var payload = {
            details: value.message,
            offers: +!!sample.data('listing-offers-url'), // value -> bool -> int
            buyout: sample.data('listing-buyout'),
            tradeoffer_url: sample.data('listing-offers-url'),
            'user-id': userId,
            metal: value.metal,
            keys: value.keys,
            earbuds: value.earbuds
        };
        
        // id: current item id
        $.post("http://backpack.tf/classifieds/add/" + id, payload, function () {
            $('[data-id="' + id + '"]').css('opacity', 0.6).data('can-sell', 0)
            .find('.equipped').html('<i class="fa fa-tag"></i> ' + qlFormatValue(value, false));
        });
    }
    
    function collectButtonValues() {
        var elems = $('.ql-button-values'),
            values = [];
        
        elems.each(function () {
            values.push(buttonValue($(this)));
        });
        
        return values;
    }
    
    function buttonValue(elem) {
        var idx = $(".ql-button-value-idx");
        if (idx.length) return values[idx.data('idx')];
        
        return {
            metal: +(Math.abs(parseFloat(elem.find('.ql-button-value-metal').val())).toFixed(2)) || 0,
            keys: Math.abs(parseInt(elem.find('.ql-button-value-keys').val(), 10)) || 0,
            earbuds: Math.abs(parseInt(elem.find('.ql-button-value-earbuds').val(), 10)) || 0,
            message: elem.find('.ql-button-value-message').val() || ""
        };
    }

    function quicklistBtnHtml(metal, keys, earbuds, message) {
        return '<div class="ql-button-values">'
            + '<label>Metal</label> <input type="text" class="ql-button-value-metal" size="3" value="' + metal + '"> '
            + '<label>Keys</label> <input type="text" class="ql-button-value-keys" size="3" value="' + keys + '"> '
            + '<label>Earbuds</label> <input type="text" class="ql-button-value-earbuds" size="3" value="' + earbuds + '"> '
            + '<a class="btn btn-primary btn-xs ql-action-button" data-action="remove">Remove</a><br>'
            + '<label>Message </label> <input type="text" class="ql-button-value-message" size="65" value="' + sanitize(message).replace(/"/g, "&quot;") + '">'
            + '</div>';
    }
    
    function quicklistSelectHtml(value, idx) {
        return '<div class="ql-button-value-idx" data-idx="' + idx + '">'
            + '<label>Value</label> ' + qlFormatValue(value, false)
            + ' <a class="btn btn-primary btn-xs ql-action-button" data-action="select">Select</a><br>'
            + '<label>Message </label> ' + (sanitize(value.message) || "(none)")
            + '</div>';
    }
    
    function modifyQuicklists() {
        var html = "<p>Add, edit, and remove quicklist buttons here. Metal can have two decimals, keys and earbuds must be integers (no decimals). If any value is missing, it is defaulted to 0, with the exception of the message, which then is empty.</p>"
        + "<p>Press the Save & Reload button to save your changes and reload the page, or press the <i>x</i> button in the right corner to discard your changes.</p>"
        + "<div id='ql-button-listing'>";
        
        values.forEach(function (vals) {
            html += quicklistBtnHtml(vals.metal, vals.keys, vals.earbuds, vals.message);
        });
        html += "</div>"
        + '<br><a class="btn btn-default ql-action-button" data-action="add">Add</a>';
        
        modal("Modify Quicklists", html, '<a class="btn btn-default btn-primary ql-action-button" data-action="save">Save & Reload</a>');
    }
    
    function selectQuicklist() {
        if (!findSample().length) {
            return alert("Create a regular listing first, so the trade offer url can be copied.");
        }
        
        var html = "<p>Select a quicklist for this batch of items:</p>"
        + "<div id='ql-cloned-batch'></div>"
        + "<br><br><br><br><br>"
        + "<div id='ql-button-listing'>";
        
        values.forEach(function (vals, idx) {
            html += quicklistSelectHtml(vals, idx);
        });
        
        html += "</div>";
        
        modal("Select Quicklist", html, '');
        $("#ql-cloned-batch").html(currentSelection().clone());
    }
    
    if (!$('#bp-custom-actions').length) {
        $('#profile-dropdown-container .dropdown-menu .divider').eq(1).after('<li class="divider" id="bp-custom-actions"></li>');
    }
    
    $('#bp-custom-actions').before('<li id="bp-custom-modify-quicklists"><a href="##"><i class="fa fa-fw fa-tag"></i> Modify Quicklists</a></li>');
    $('#bp-custom-modify-quicklists').click(modifyQuicklists);
    
    bppr.html(
        '<a id="bp-custom-select-ql" class="btn btn-default btn-primary btn-xs disabled" href="##" style="margin-top: -2px;">Select quicklist</a>'
        + ' <a id="show-markdown-modal" class="btn btn-default btn-primary btn-xs" href="##" style="margin-top: -2px;">Convert to text</a>'
    );
    
    $(document).on('click', '.quicklist', function () {
        var $this = $(this),
            value = values[$this.data('value-idx')],
            id = $this.data('id'),
            sample = findSample();
        
        if (!verified) {
            if (!confirm("Enable quicklisting? Refresh the page to disable.")) return;
            verified = true;
        }
        
        if (!sample.length) {
            return alert("Create a regular listing first, so the trade offer url can be copied.");
        }
        
        listItem(id, value, sample);
    }).on('click', '.ql-action-button', function () {
        var $this = $(this),
            action = $this.data('action');
        
        if (action === 'add') {
            $("#ql-button-listing").append(quicklistBtnHtml("", "", ""));
        } else if (action === 'remove') {
            $this.parent().remove();
        } else if (action === 'save') {
            values = collectButtonValues().filter(function (v) {
                return (v.metal || v.keys || v.earbuds) && isFinite(v.metal) && isFinite(v.keys) && isFinite(v.earbuds);
            });
            
            localStorage.setItem("bp-custom-quicklists", JSON.stringify(values));
            location.reload();
        } else if (action === 'select') {
            $("#active-modal").modal('hide');
            listSelection(buttonValue($this.parent()));
        }
    });
    
    $('.item:not(.spacer)').click(function () {
        $("#bp-custom-select-ql").toggleClass("disabled", !selection_mode);
    });
    
    $("#bp-custom-select-ql").click(function () {
        if (selection_mode) selectQuicklist();
    });
    
    var customlists = localStorage.getItem("bp-custom-quicklists");
    if (customlists) {
        values = JSON.parse(customlists);
    } else {
        values = [
            {metal: 0.05, keys: 0, earbuds: 0, message: ""},
            {metal: 0.11, keys: 0, earbuds: 0, message: ""},
            {metal: 0, keys: 1, earbuds: 0, message: ""},
        ];
        localStorage.setItem("bp-custom-quicklists", JSON.stringify(values));
    }
    
    window.createDetails = createDetails;
});
