"use strict";

$(document).ready(function () {
    onDOMReady();
});

class Mesh {
    constructor() {
        this.el = null;
        this.lines = [
            [
                [10, 5, 3], [40, 20, 8]
            ],
            [
                [30, 30, 4], [80, 10, 6]
            ],
            [
                [10, 40, 3], [90, 40, 9]
            ]
        ];

        this.transformedLines = [];

        this.pos = [0, 10, 10];
    }

    toViewport(vec) {
        return math.multiply(this.matrixToViewPort, math.matrix(vec).resize([4], 1));
    }

    updateTransformation() {
        this.viewMatrix = math.matrix(
            [
                [1, 0, 0, -this.pos[0]],
                [0, 1, 0, -this.pos[1]],
                [0, 0, 1, -this.pos[2]],
                [0, 0, 0, 1]
            ]
        );


        this.projectionMatrix = math.matrix(
        [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ]
        );

        this.matrixToViewPort = math.multiply(this.projectionMatrix, this.viewMatrix);

        this.transformedLines = [];
        for (let l of this.lines) {
            let coords = [];
            for (let coord of l) {
                coords.push(this.toViewport(coord));
            }
            this.transformedLines.push(coords);
        }
    }

    updateRender() {
        if (this.el != null) {
            this.el.remove();
            this.el = null;
        }

        this.el = document.createElementNS("http://www.w3.org/2000/svg", "g");
        for (let l of this.transformedLines) {
            let lineEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            lineEl.style.stroke = "black";
            lineEl.style.strokeWidth = 0.8;
            lineEl.setAttribute("d", `M ${l[0].subset(math.index(0))} ${l[0].subset(math.index(1))} L ${l[1].subset(math.index(0))} ${l[1].subset(math.index(1))}`);

            this.el.appendChild(lineEl);
        }

        $("#viewport")[0].appendChild(this.el);
    }

    update() {
        this.updateTransformation();
        this.updateRender();
    }
}

let mesh = null;

function onDOMReady() {
    // let el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // el.style.stroke = "black";
    // el.style.strokeWidth = 6;
    // el.setAttribute("d", "M 0 0 L 70 70");

    //$("#viewport")[0].appendChild(el);

    mesh = new Mesh();
    mesh.update();

    //console.log("Hey!");
}

