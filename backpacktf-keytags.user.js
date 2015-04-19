// ==UserScript==
// @name         backpack.tf key tags
// @namespace    http://steamcommunity.com/id/caresx/
// @version      1.0.0
// @description  Replaces bud price tags on items with the key equivalent.
// @author       cares
// @match        *://backpack.tf/*
// @grant        none
// ==/UserScript==

$('[data-p-bptf-all]').each(function () {
    var $this = $(this),
        equipped = $this.find('.equipped'),
        price = $this.data('p-bptf'),
        bpall = $this.data('p-bptf-all');
    
    // Ignore items without a bud pricetag and those that are listed
    if (!(/bud/.test(equipped.text())) || $this.data('listing-steamid')) {
        return;
    }
    
    if (/key/.test(bpall)) { // USD
        price = bpall.match(/(?:\d+\.)?\d+ keys?/)[0];
    }
    
    equipped.text('~' + price);
});
