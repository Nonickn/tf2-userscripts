// ==UserScript==
// @name         backpack.tf Quick Listing
// @namespace    http://steamcommunity.com/id/caresx/
// @version      1.3.0
// @description  Quickly list your items on backpack.tf Classifieds
// @author       cares
// @match        *://backpack.tf/profiles/*
// @grant        none
// ==/UserScript==

$(function () {
    var userId = $('a[href^="/logout"]').attr('href').replace(/(.*?=)/, ''),
        verified = false,
        cd = window.createDetails,
        um = window.updateMargins,
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
    
    if (!$('#bp-custom-actions').length) {
        $('#profile-dropdown-container .dropdown-menu .divider').eq(1).after('<li class="divider" id="bp-custom-actions"></li>');
    }
    
    $('#bp-custom-actions').before('<li id="bp-custom-modify-quicklists"><a href="##"><i class="fa fa-fw fa-tag"></i> Modify Quicklists</a></li>');
    $('#bp-custom-modify-quicklists').click(modifyQuicklists);
    
    bppr.html(
        '<a id="bp-custom-select-ql" class="btn btn-default btn-primary btn-xs disabled" href="##" style="margin-top: -2px;">Quicklist selection</a>'
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
            $("#ql-button-listing").append(quicklistBtnHtml("", "", "", ""));
        } else if (action === 'remove') {
            $this.parent().remove();
        } else if (action === 'save') {
            values = collectButtonValues().filter(function (v) {
                return (v.metal || v.keys || v.earbuds) && isFinite(v.metal) && isFinite(v.keys) && isFinite(v.earbuds);
            });
            
            localStorage.setItem("bp-custom-quicklists", JSON.stringify(values));
            location.reload();
        } else if (action === 'select') {
            copyButtonValues(values[$(this).data('idx')], $('.ql-button-values'));
        } else if (action === 'listbatch') {
            listSelection(buttonValue($('.ql-button-values')));
            $('#active-modal').modal('hide');
        }
    });
    
    $('.item:not(.spacer)').click(updateSelectQuicklist);
    
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
            {metal: 0, keys: 1, earbuds: 0, message: ""}
        ];
        localStorage.setItem("bp-custom-quicklists", JSON.stringify(values));
    }
    
    addSelectPage();
    window.createDetails = _createDetails;
    window.updateMargins = _updateMargins;

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
    
    function _createDetails(item) {
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
    
    function _updateMargins() {
        um();
        addSelectPage();
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
            half = selection.length / 2,
            items = [],
            at = 0;
        
        clearSelection();
        updateClearSelectionState();
        selection.each(function (idx) {
            if (idx >= half) return;
            
            var $this = $(this);
            items.push($this.data('id'));
            
            $this.find('.equipped').html('<i class="fa fa-spin fa-spinner"></i>');
        });
        
        function next() {
            if (!items[at]) return;
            listItem(items[at], value, sample, function () {
                at += 1;
                next();
            });
        }
        
        next();
    }
    
    function listItem(id, value, sample, then) {
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
        $.post("http://backpack.tf/classifieds/add/" + id, payload, function (page) {
            var ok = /<i class="fa fa-check-circle"><\/i> Your listing was posted successfully. <\/div>/.test(page),
                item = $('[data-id="' + id + '"]');
            
            item.css('opacity', 0.6).data('can-sell', 0)
                .find('.equipped').html(ok ? '<i class="fa fa-tag"></i> ' + qlFormatValue(value, false) : '<i class="fa fa-exclamation-circle" style="color:red"></i>');
            
            if (!ok && !confirm("Error occured, continue listing?")) return;
            if (then) then();
        });
    }
    
    function escapeHtml(message) {
        return sanitize(message).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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
        return {
            metal: +(Math.abs(parseFloat(elem.find('.ql-button-value-metal').val())).toFixed(2)) || 0,
            keys: Math.abs(parseInt(elem.find('.ql-button-value-keys').val(), 10)) || 0,
            earbuds: Math.abs(parseInt(elem.find('.ql-button-value-earbuds').val(), 10)) || 0,
            message: elem.find('.ql-button-value-message').val() || ""
        };
    }
    
    function copyButtonValues(value, elem) {
        var i;
        
        for (i in value) {
            if (!value.hasOwnProperty(i)) continue;
            elem.find('.ql-button-value-' + i).val(value[i] || (i === "message" ? "" : "0"));
        }
    }
    
    function quicklistBtnHtml(metal, keys, earbuds, message, remove) {
        return '<div class="ql-button-values form-inline">'
            + '<div style="display: inline-block; padding-left: 3px;"><label>Metal</label></div>'
            + ' <div style="display: inline-block; padding-left: 37px;"><label>Keys</label></div>'
            + ' <div style="display: inline-block; padding-left: 42px;"><label>Earbuds</label></div> '
            + (remove !== false ? '<a class="btn btn-primary btn-xs ql-action-button" data-action="remove" style="margin-left: 15px;">Remove</a>' : '') + '<br>'
            + '<input type="number" class="ql-button-value-metal form-control" style="width: 70px; height: 32px; margin-bottom: 3px; margin-top: -2px;" value="' + metal + '"> '
            + '<input type="number" class="ql-button-value-keys form-control" style="width: 70px; height: 32px; margin-bottom: 3px; margin-top: -2px;" value="' + keys + '"> '
            + '<input type="number" class="ql-button-value-earbuds form-control" style="width: 70px; height: 32px; margin-bottom: 3px; margin-top: -2px;" value="' + earbuds + '"> '
            + '<br><label style="margin-top: 4px; margin-left: 3px;">Message </label> '
            + '<input type="text" class="ql-button-value-message form-control" value="' + escapeHtml(message) + '" style="height: 32px; margin-bottom: 15px;">'
            + '</div>';
    }
    
    function quicklistSelectHtml(value, idx) {
        return '<a class="btn btn-primary ql-button-value-idx ql-action-button" data-action="select" data-idx="' + idx + '" style="margin-right: 3px;">' + qlFormatValue(value, true) + '</a>';
    }
    
    function modifyQuicklists() {
        var html = "<p>Add, edit, and remove quicklist buttons here. Metal can have two decimals, keys and earbuds must be integers (no decimals). If any value is missing, it is defaulted to 0, with the exception of the message, which then is empty.</p>"
        + "<p>Press the Save & Reload button to save your changes and reload the page, or press the <i>x</i> button in the right corner to discard your changes.</p>"
        + "<div id='ql-button-listing'>";
        
        values.forEach(function (vals) {
            html += quicklistBtnHtml(vals.metal, vals.keys, vals.earbuds, vals.message);
        });
        html += "</div>"
        + '<a class="btn btn-default ql-action-button" data-action="add">Add</a>';
        
        modal("Modify Quicklists", html, '<a class="btn btn-default btn-primary ql-action-button" data-action="save">Save & Reload</a>');
    }
    
    function selectQuicklist() {
        if (!findSample().length) {
            return alert("Create a regular listing first, so the trade offer url can be copied.");
        }
        
        if (!currentSelection().length) {
            return alert("No listable items in this selection.");
        }
        
        var html = "<p>Select a quicklist for this batch of items, or enter one manually. Click on the respective button to fill in the values.</p>"
        + "<div id='ql-cloned-batch' class='row'></div>"
        + "<div id='ql-button-listing' class='row'>";
        
        values.forEach(function (vals, idx) {
            html += quicklistSelectHtml(vals, idx);
        });
        
        html += "</div><br>";
        html += quicklistBtnHtml("", "", "", "", false);
        
        modal("Select Quicklist", html, '<a class="btn btn-default btn-primary ql-action-button" data-action="listbatch">List Batch</a>');
        
        $("#ql-cloned-batch").html(currentSelection().clone()).find('.item').addClass('ql-cloned');
        $("#ql-button-listing .ql-select-msg").last().css('margin-bottom', '-8px');
        $(".ql-button-value-idx").tooltip({
            html: false,
            title: function () { return values[$(this).data('idx')].message || "(none)"; },
            placement: 'top'
        });
        addItemPopovers();
    }
    
    function addItemPopovers() {
        $('.ql-cloned').mouseenter(function() {
            var $this = $(this);
            
            if ($(this).parent().hasClass('item-list-links')) {
                return;
            }
            
            $(this).popover({animation: false, html: true, trigger: 'manual', placement: window.get_popover_placement, content: cd($this)});
            setTimeout(function () {
                if ($this.is(':hover')) {
                    $('.popover').remove();
                    $this.popover('show');
                    $('.popover').css('padding', 0);
                    
                    $('#search-bazaar').click(function () {
                        searchBazaar($this.data('defindex'), $this.data('quality'), $this.data('priceindex'), $this.data('craftable') == 1 ? 0 : 1, $this.data('app'));
                    });
                    
                    $('#search-outpost').click(function () {
                        searchOutpost($this.data('defindex'), $this.data('quality'), $this.data('priceindex'), $this.data('craftable') == 1 ? 0 : 1, $this.data('app'));
                    });
                    
                    $('#search-lounge').click(function() {
                        searchLounge($this.data('defindex'), $this.data('quality'));
                    });
                }
            }, 300);
        }).mouseleave(function () {
            var $this = $(this);
            
            setTimeout(function () {
                if (!$this.is(':hover') && !$('.popover').is(':hover')) {
                    $this.popover('hide');
                }
            }, 100);
        }).on('shown.bs.popover', function () {
            $('.popover-timeago').timeago();
        });
        
        $("#ql-cloned-batch").on('mouseleave', '.popover', function () {
            var $this = $(this);
            
            setTimeout(function() {
                if (!$this.is(':hover')) {
                    $this.remove();
                }
            }, 300);
        });
    }
    
    function addSelectPage() {
        function selectItems(items) {
            selection_mode = true;
            selectItem(items);
            
            updateClearSelectionState();
            calculateValue();
        }
        
        $('.pagenum').each(function () {
            var $this = $(this),
                label = $this.find('.label'),
                page = label[0].id.replace('page', '');

            label.after('<span class="btn btn-primary btn-xs pull-right ql-select-page" data-page="' + page + '" style="margin-right: 16px;">Select Page</span>');
        });
    
        $('.ql-select-page').click(function () {
            var page = +this.dataset.page - 1,
                start = page * 50 + 1,
                end = page * 50 + 50,
                pageitems;

            if (page >= 0) {
                pageitems = $('.item:not(.spacer)').filter(function () {
                    var slot = this.dataset.bpslot;
                    return slot >= start && slot <= end;
                });
            } else { // new items
                pageitems = $('#newlist .item');
            }

            if (!pageitems.length) return;

            if (selection_mode) {
                if (pageitems.length === pageitems.not('.unselected').length) { // all == selected
                    unselectItem(pageitems);

                    if ($('.item:not(.unselected)').length === 0) {
                        clearSelection();
                        updateSelectQuicklist();
                        return;
                    }
                } else {
                    selectItems(pageitems);
                    updateSelectQuicklist();
                }
            } else {
                unselectItem($('.item'));
                selectItems(pageitems);
                updateSelectQuicklist();
            }
        }); 
    }
    
    function updateSelectQuicklist() {
        $("#bp-custom-select-ql").toggleClass("disabled", !selection_mode);
    }
});
