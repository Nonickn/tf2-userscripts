// ==UserScript==
// @name         backpack rep.tf integration
// @namespace    http://steamcommunity.com/id/caresx/
// @version      1.1.1
// @description  rep.tf integration for backpack.tf
// @author       cares
// @match        *://backpack.tf/*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js
// @require      https://cdn.rawgit.com/twbs/bootstrap/ba1345f144283d579b07cd40b5ae5a5b84d2b2e7/js/tooltip.js
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

$(function () {
    var scr = document.createElement('script'),
        groups = [],
        bans = [],
        bansShown = false,
        cachePruneTime = 60 * 30 * 1000, // 30 minutes (in ms)
        banIssuers = ["steamBans", "opBans", "stfBans", "bzBans", "ppmBans", "bbgBans", "tf2tBans", "bptfBans", "srBans", "mctBans"],
        reptfSuccess = true,
        steamid, repCache;
    
    function generateMiniProfile(element) {
        var profile = rep_gmp(element);
        
        profile.find('.stm-tf2outpost').parent().html('<i class=\"stm stm-tf2outpost\"></i> Outpost')
        profile.find('.stm-bazaar-tf').parent().html('<i class=\"stm stm-bazaar-tf\"></i> Bazaar')
        profile.find('.mini-profile-third-party').append(' <a class=\"btn btn-default btn-xs\" target=\"_blank\" href=\"http://rep.tf/'+ element.attr('data-id')+'\">'
                                                         + '<i class=\"fa fa-check-square\"></i> RepTF</a>');
        return profile;
    }
    
    // Mini profile - enabled on all pages
    scr.textContent = 'var rep_gmp = generateMiniProfile;'
    + "window.generateMiniProfile = " + generateMiniProfile;
    
    (document.body || document.head || document.documentElement).appendChild(scr);
    
    // RepTF checks on profiles
    steamid = $('.profile .avatar-container a')[0];
    if (!steamid) return;
    
    steamid = steamid.href.replace(/\D/g, '');
    
    $('.btn > .stm-tf2outpost').parent().after(' <a class="btn btn-primary btn-xs" href="http://rep.tf/' + steamid + '" target="_blank"><i class="fa fa-check-square"></i> rep.tf</a>');
    $('small:contains(Community)').html('Community <a id="showrep" style="font-size: 14px; cursor: pointer;">+</a>');
    
    $('#showrep').on('click', function () {
        var $this = $(this),
            open = $this.text() === '+';
        
        if (open && !bansShown) {
            showBansModal();
            bansShown = true;
        }
        
        $this.text(open ? '-' : '+');
        $('.rep-entry').toggle(open);
    });
    
    repCache = JSON.parse(localStorage.getItem("custom-reptf") || "{}");
    
    addHtml();
    checkCache();
    
    function spinner(name) {
        var id = name.replace(/\.|-/g, '').toLowerCase();
        groups.push(""
            + "<li id='" + id + "ban' class='rep-entry' style='display: none'><small>" + name + "</small>"
            + "<span class='label pull-right label-default rep-tooltip' data-placement='bottom'>"
            + "<i class='fa fa-spin fa-spinner'></i></span></li>");
    }
    
    function addHtml() {
        spinner("Outpost");
        spinner("Bazaar");
        spinner("Scrap.tf");
        spinner("PPM");
        // Uncomment to enable
        //spinner("TF2-Trader");
        //spinner("MCT");
        //spinner("BBG");
        $('.community-statii .stats li').last().after($(groups.join("")));
    }
    
    function ban(name, obj) {
        var id = name.replace(/\.|-/g, '').toLowerCase(),
            status = $('#' + id + 'ban').find('.rep-tooltip');
        
        status.removeClass('label-default');
        
        if (reptfSuccess) {
            if (!obj.banned) return;

            if (obj.banned === "bad") {
                bans.push({name: name, reason: obj.message});
            }
            
        	status.addClass("label-" + ({good: "success", bad: "danger"}[obj.banned]))
            .data('content', obj.message)
            .text({good: "OK", bad: "BAN"}[obj.banned]);
        } else {
            status.addClass("label-warning").data('content', "Ban status could not be retrieved.").text("ERR");
        }
    }
    
    function showBans(json) {
        ban("SteamRep", json.srBans);
        ban("Outpost", json.opBans);
        ban("Bazaar", json.bzBans);
        ban("Backpack.tf", json.bptfBans);
        ban("Scrap.tf", json.stfBans);
        ban("PPM", json.ppmBans);
        //ban("TF2-Trader", json.tf2tBans);
        //ban("MCT", json.mctBans);
        //ban("BBG", json.bbgBans);
        
        $('.rep-tooltip').tooltip({
            html: true,
            title: function () {
                return $(this).data('content');
            }
        });
        
        $('#showrep').css('color', reptfSuccess ? (bans.length ? '#D9534F' : '#5CB85C') : '#F0AD4E');
    }
    
    function showBansModal() {
        if (!bans.length) return;
        
        var html = "<b style='color:red'>User is banned on</b> ⋅ <a href='http://rep.tf/" + steamid + "' target='_blank'>rep.tf</a><br><br><ul>";
        bans.forEach(function (ban) {
            html += "<li><b>" + ban.name + "</b> - " + ban.reason + "</li>";
        });
        html += "</ul>";
        
        unsafeWindow.modal("rep.tf bans", html);
    }
    
    function checkCache() {
        var updated = pruneCache();

        if (repCache[steamid]) {
            showBans(repCache[steamid].json);
            if (updated) saveCache();
        } else {
            updateCache();
        }
    }

    function compactResponse(json) {
        var compact = {success: json.success};
        
        banIssuers.forEach(function (issuer) {
            compact[issuer] = {banned: json[issuer].banned, message: json[issuer].message};
        });
        
        return compact;
    }
    
    function updateCache() {
        GM_xmlhttpRequest({
            method: "POST",
            url: "http://rep.tf/api/bans?str=" + steamid,
            onload: function (resp) {
                var json = compactResponse(JSON.parse(resp.responseText));

                reptfSuccess = json.success;
                repCache[steamid] = {time: Date.now(), json: json};
                
                showBans(json);
                if (!reptfSuccess) saveCache();
            }
        });
    }
    
    function saveCache() {
        localStorage.setItem("custom-reptf", JSON.stringify(repCache));
    }
    
    function pruneCache() {
        var updated = false,
            time, uid;
        
        for (uid in repCache) {
            time = repCache[uid].time;
            
            if (time + cachePruneTime < Date.now()) {
                updated = true;
                delete repCache[uid];
            }
        }
        
        return updated;
    }
});
