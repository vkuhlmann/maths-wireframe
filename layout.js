"use strict";

$(document).ready(function () {
    onDOMReady();
});


function getTetraederPoints(mesh) {
    let distanceBetweenPoints = 10.0;
    // a^2 = b^2 + c^2 - 2bc*cos()
    // a^2 = 2*b^2 - b*b^2 * cos()
    // b = sqrt(a^2 / (2 - cos())
    let angle = Math.PI * 2.0 / 3.0;
    let radius = Math.sqrt(distanceBetweenPoints * distanceBetweenPoints / (2 - Math.cos(angle)));
    let height = Math.sqrt(distanceBetweenPoints * distanceBetweenPoints - radius * radius);

    let tetrRad = radius;
    let tetrHeight = height;

    let point0 = [
        0.0,
        distanceBetweenPoints - height,
        -radius,
        1.0];

    let point1 = [
        -Math.sin(angle) * radius,
        distanceBetweenPoints - height,
        -Math.cos(angle) * radius,
        1.0];

    let point2 = [
        -Math.sin(angle * 2.0) * radius,
        distanceBetweenPoints - height,
        -Math.cos(angle * 2.0) * radius,
        1.0];

    let point3 = [
        0.0,
        distanceBetweenPoints,
        0.0,
        1.0];

    let line = [
        point0, point1, point2, point0, point3, point1, null,
        point3, point2
    ];

    for (let i = 0; i < line.length; i++) {
        if (line[i] == null || line[i + 1] == null)
            continue;
        mesh.lines.push([line[i], line[i + 1]]);
    }

    // mod->AddLines(points, transf);
    // mod->AddObscuration(Canvas3D::MathTriangle{ point0, point1, point2 } *transf);
    // mod->AddObscuration(Canvas3D::MathTriangle{ point1, point2, point3 } *transf);
    // mod->AddObscuration(Canvas3D::MathTriangle{ point2, point3, point0 } *transf);
    // mod->AddObscuration(Canvas3D::MathTriangle{ point0, point1, point3 } *transf);

};

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
        this.pos = [0, 5, 2];
    }

    toViewport(vec) {
        let v = math.multiply(this.matrixToViewPort, math.matrix(vec).resize([4], 1));
        v = math.multiply(v, 1.0 / v.subset(math.index(3)));
        return v;
    }

    updateTransformation() {
        let pitch = 0;
        let yaw = 0;

        this.viewMatrix = math.rotationMatrix(pitch, math.matrix([1, 0, 0]));
        this.viewMatrix = math.multiply(this.viewMatrix,
            math.rotationMatrix(yaw, math.matrix([0, 1, 0])));
        this.viewMatrix = math.resize(this.viewMatrix, [4, 4]);
        this.viewMatrix.subset(math.index(3, 3), 1);

        this.viewMatrix = math.multiply(this.viewMatrix,
            math.matrix(
                [
                    [1, 0, 0, -this.pos[0]],
                    [0, 1, 0, -this.pos[1]],
                    [0, 0, 1, -this.pos[2]],
                    [0, 0, 0, 1]
                ]
            ));

        let FOVDegr = 70;
        let halfFOVAngle = (FOVDegr / 2) * Math.PI / 180;

        this.projectionMatrix = math.matrix(
            [
                [Math.cos(halfFOVAngle), 0, 0, 0],
                [0, Math.cos(halfFOVAngle), 0, 0],
                [0, 0, 1, 0],
                [0, 0, Math.sin(halfFOVAngle), 0]
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

    getTetraederPoints(mesh);

    mesh.update();

    window.setInterval(() => { mesh.update(); }, 200);
}
