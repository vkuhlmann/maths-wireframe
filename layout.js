"use strict";

$(document).ready(function () {
    onDOMReady();
});

function onDOMReady() {
    let el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.style.stroke = "yellow";
    el.style.strokeWidth = 6;
    el.setAttribute("d", "M 0 0 L 70 70");

    $("#viewport")[0].appendChild(el);

    console.log("Hey!");
}

