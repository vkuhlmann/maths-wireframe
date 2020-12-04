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

        this.pos = math.matrix([0, 10, 10, 1]);
        this.pos = math.matrix([0, 0, 20, 1]);

        this.pitch = 0;
        this.yaw = 0;
    }

    toViewspace(vec) {
        let v = math.multiply(this.viewMatrix, math.matrix(vec).resize([4], 1));
        v = math.multiply(v, 1.0 / Math.abs(v.subset(math.index(3))));
        return v;
    }

    toProjectedSpace(vec) {
        let v = math.multiply(this.projectionMatrix, math.matrix(vec).resize([4], 1));
        v = math.multiply(v, 1.0 / Math.abs(v.subset(math.index(3))));
        return v;
    }

    toViewport(vec) {
        let v = math.multiply(this.matrixToViewPort, math.matrix(vec).resize([4], 1));
        v = math.multiply(v, 1.0 / v.subset(math.index(3)));
        return v;
    }

    updateTransformation() {
        let pitch = this.pitch;
        let yaw = this.yaw;

        this.viewMatrix = math.rotationMatrix(pitch, math.matrix([1, 0, 0]));
        this.viewMatrix = math.multiply(this.viewMatrix,
            math.rotationMatrix(yaw, math.matrix([0, 1, 0])));
        this.viewMatrix = math.resize(this.viewMatrix, [4, 4]);
        this.viewMatrix.subset(math.index(3, 3), 1);

        this.viewMatrix = math.multiply(this.viewMatrix,
            math.matrix(
                [
                    [1, 0, 0, -this.pos.subset(math.index(0))],
                    [0, 1, 0, -this.pos.subset(math.index(1))],
                    [0, 0, 1, -this.pos.subset(math.index(2))],
                    [0, 0, 0, 1]
                ]
            ));

        this.viewInverse = math.inv(this.viewMatrix);

        let FOVDegr = 70;
        let halfFOVAngle = (FOVDegr / 2) * Math.PI / 180;

        let heightFactor = 25;

        this.projectionMatrix = math.matrix(
            [
                [heightFactor * Math.cos(halfFOVAngle), 0, 0, 0],
                [0, -heightFactor * Math.cos(halfFOVAngle), 0, 0],
                [0, 0, -1, 0],
                [0, 0, -Math.sin(halfFOVAngle), 0]
            ]
        );

        this.matrixToViewPort = math.multiply(this.projectionMatrix, this.viewMatrix);

        this.transformedLines = [];
        const minZ = 1e-12;

        for (let l of this.lines) {
            let output = {};
            output.from = this.toViewspace(l[0]);
            output.to = this.toViewspace(l[1]);

            let behindCount = (output.from.subset(math.index(2)) > -minZ) + 
                (output.to.subset(math.index(2)) > -minZ);

            if (behindCount == 2) {
                continue;
            } else if (behindCount == 1) {
                if (output.from.subset(math.index(2)) > -minZ) {
                    let swap = output.from;
                    output.from = output.to;
                    output.to = swap;
                }

                let fromZ = output.from.subset(math.index(2)) + minZ;
                let toZ = output.to.subset(math.index(2)) + minZ;

                let frac = -fromZ / (toZ - fromZ);
                output.to = math.add(math.multiply(math.subtract(output.to, output.from), frac), output.from);
            }

            output.from = this.toProjectedSpace(output.from);
            output.to = this.toProjectedSpace(output.to);

            // let coords = [];
            // for (let coord of l) {
            //     coords.push(this.toViewport(coord));
            // }
            // this.transformedLines.push(coords);
            this.transformedLines.push(output);
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
            // lineEl.setAttribute("d", `M ${l[0].subset(math.index(0))} ${l[0].subset(math.index(1))} L ${l[1].subset(math.index(0))} ${l[1].subset(math.index(1))}`);
            lineEl.setAttribute("d", `M ${l.from.subset(math.index(0))} ${l.from.subset(math.index(1))} ` + 
            `L ${l.to.subset(math.index(0))} ${l.to.subset(math.index(1))}`);

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

let isShiftDown = false;
let isSpacebarDown = false;

let isWDown = false;
let isADown = false;
let isSDown = false;
let isDDown = false;
let frame = 0;

let isLookRightDown = false;
let isLookLeftDown = false;
let isLookUpDown = false;
let isLookDownDown = false;

let targetFPS = 30;

function update() {
    frame += 1;
    let speed = 4;

    if (isSpacebarDown) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [0, speed / targetFPS, 0, 0]));
        //mesh.pos[1] = mesh.pos[1] + speed / targetFPS;
    } else if (isShiftDown) {
        //mesh.pos[1] = mesh.pos[1] - speed / targetFPS;
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [0, -speed / targetFPS, 0, 0]));
    }

    if (isWDown) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [0, 0, -speed / targetFPS, 0]));
        //mesh.pos[2] = mesh.pos[2] + speed / targetFPS;
    } else if (isSDown) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [0, 0, speed / targetFPS, 0]));
        //mesh.pos[2] = mesh.pos[2] - speed / targetFPS;
    }

    if (isDDown) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [speed / targetFPS, 0, 0, 0]));
        //mesh.pos[0] = mesh.pos[0] + speed / targetFPS;
    } else if (isADown) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [-speed / targetFPS, 0, 0, 0]));
        //mesh.pos[0] = mesh.pos[0] - speed / targetFPS;
    }

    if (isLookRightDown) {
        mesh.yaw += Math.PI / (2 * targetFPS);
    } else if (isLookLeftDown) {
        mesh.yaw -= Math.PI / (2 * targetFPS);
    }

    if (isLookDownDown) {
        mesh.pitch += Math.PI / (2 * targetFPS);
    } else if (isLookUpDown) {
        mesh.pitch -= Math.PI / (2 * targetFPS);
    }


    if ((frame % (5 * targetFPS)) === 0) {
        //console.log(`x=${mesh.pos[0].toFixed(2)}, y=${mesh.pos[1].toFixed(2)}, z=${mesh.pos[2].toFixed(2)}`);
        console.log(`x=${mesh.pos.subset(math.index(0)).toFixed(2)}, ` +
            `y=${mesh.pos.subset(math.index(1)).toFixed(2)}, ` +
            `z=${mesh.pos.subset(math.index(2)).toFixed(2)}`);
    }

    mesh.update();
}

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

    window.setInterval(() => { update(); }, 1000 / targetFPS);

    $("body")[0].addEventListener("keydown", function (e) {
        if (e.key === " ") {
            isSpacebarDown = true;
        } else if (e.key === "Shift") {
            isShiftDown = true;
        } else if (e.key === "w") {
            isWDown = true;
        } else if (e.key === "a") {
            isADown = true;
        } else if (e.key === "s") {
            isSDown = true;
        } else if (e.key === "d") {
            isDDown = true;
        } else if (e.key === "6") {
            isLookRightDown = true;
        } else if (e.key === "4") {
            isLookLeftDown = true;
        } else if (e.key === "8") {
            isLookUpDown = true;
        } else if (e.key === "2") {
            isLookDownDown = true;
        }
    });

    $("body")[0].addEventListener("keyup", function (e) {
        if (e.key === " ") {
            isSpacebarDown = false;
        } else if (e.key === "Shift") {
            isShiftDown = false;
        } else if (e.key === "w") {
            isWDown = false;
        } else if (e.key === "a") {
            isADown = false;
        } else if (e.key === "s") {
            isSDown = false;
        } else if (e.key === "d") {
            isDDown = false;
        } else if (e.key === "6") {
            isLookRightDown = false;
        } else if (e.key === "4") {
            isLookLeftDown = false;
        } else if (e.key === "8") {
            isLookUpDown = false;
        } else if (e.key === "2") {
            isLookDownDown = false;
        }
    });
}

