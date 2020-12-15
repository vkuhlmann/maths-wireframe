"use strict";

let isFocusToggled = false;

$(document).ready(function () {
    onDOMReady();

    $("#import-file").on("change", importFromFileEvent);

    toggleFocus = () => {
        if (isFocusToggled) {
            isFocusToggled = false;
            $("#toggleFocus").removeClass("toggled");
        } else {
            isFocusToggled = true;
            $("#toggleFocus").addClass("toggled");
        }
    };

    $("#toggleFocus").click((e) => {
        toggleFocus();
    });

    toggleFocus();

});

function onZipError(message) {
    alert(message);
}

function importFromFileEvent(e) {
    let a = e.target.files[0];
    let r = new GeoGebraReader(a, () => {
        r.addPoints(mesh);
        r.parseCommands();
    });
}

class GeoGebraReader {
    constructor(a, callback) {
        let blobReader = new zip.BlobReader(a);
        this.facesMap = {};
        this.edgesMap = {};
        this.pointsMap = {};

        const that = this;

        zip.createReader(blobReader, (zipReader) => {
            zipReader.getEntries((arr) => {
                let result = null;
                for (let entry of arr) {
                    if (entry.filename === "geogebra.xml") {
                        result = entry;
                        break;
                    }
                }

                if (result == null) {
                    onZipError("Unknown data structure");
                    return;
                }

                result.getData(new zip.TextWriter(), function (text) {
                    zipReader.close(() => { });
                    //console.log(text);

                    let parser = new DOMParser();

                    that.xmlParsed = parser.parseFromString(text, "text/xml");
                    callback();

                }, function (current, total) {
                    // onprogress
                });

                console.log(arr);
            });
        }, onZipError);
    }

    addPoints(m) {
        let pointsXML = this.xmlParsed.querySelectorAll("geogebra > construction > element[type='point3d']");
        for (let p of pointsXML) {
            let coordsXML = p.querySelector("coords");
            //console.log(coordsXML.outerHTML);
            let point = [
                parseFloat(coordsXML.getAttribute("x")),
                parseFloat(coordsXML.getAttribute("y")),
                parseFloat(coordsXML.getAttribute("z")),
                parseFloat(coordsXML.getAttribute("w"))
            ];

            this.pointsMap[p.getAttribute("label")] = point;

            m.addPoint(point);
        }
    }

    parseCube(xml) {
        let input = xml.querySelector("input");
        let output = xml.querySelector("output");

        let pointLabels = [input.getAttribute("a0"), input.getAttribute("a1"), input.getAttribute("a2"),
        output.getAttribute("a1"), output.getAttribute("a2"), output.getAttribute("a3"),
        output.getAttribute("a4"), output.getAttribute("a5")];
        let faceLabels = {};
        faceLabels[output.getAttribute("a6")] = [pointLabels[0], pointLabels[1], pointLabels[2], pointLabels[3]];
        faceLabels[output.getAttribute("a7")] = [pointLabels[0], pointLabels[3], pointLabels[7], pointLabels[4]];
        faceLabels[output.getAttribute("a8")] = [pointLabels[0], pointLabels[1], pointLabels[5], pointLabels[4]];
        faceLabels[output.getAttribute("a9")] = [pointLabels[1], pointLabels[2], pointLabels[6], pointLabels[5]];
        faceLabels[output.getAttribute("a10")] = [pointLabels[2], pointLabels[3], pointLabels[7], pointLabels[6]];
        faceLabels[output.getAttribute("a11")] = [pointLabels[4], pointLabels[5], pointLabels[6], pointLabels[7]];

        let edgeLabels = {};
        edgeLabels[output.getAttribute("a12")] = [pointLabels[0], pointLabels[3]];
        edgeLabels[output.getAttribute("a13")] = [pointLabels[0], pointLabels[1]];
        edgeLabels[output.getAttribute("a14")] = [pointLabels[1], pointLabels[2]];
        edgeLabels[output.getAttribute("a15")] = [pointLabels[2], pointLabels[3]];
        edgeLabels[output.getAttribute("a16")] = [pointLabels[0], pointLabels[4]];
        edgeLabels[output.getAttribute("a17")] = [pointLabels[3], pointLabels[7]];
        edgeLabels[output.getAttribute("a18")] = [pointLabels[4], pointLabels[7]];
        edgeLabels[output.getAttribute("a19")] = [pointLabels[4], pointLabels[5]];
        edgeLabels[output.getAttribute("a20")] = [pointLabels[1], pointLabels[5]];
        edgeLabels[output.getAttribute("a21")] = [pointLabels[5], pointLabels[6]];
        edgeLabels[output.getAttribute("a22")] = [pointLabels[2], pointLabels[6]];
        edgeLabels[output.getAttribute("a23")] = [pointLabels[6], pointLabels[7]];

        for (let e of Object.values(edgeLabels)) {
            mesh.lines.push([this.pointsMap[e[0]], this.pointsMap[e[1]]]);
        }

        let transf = math.identity(4);
        for (let f of Object.values(faceLabels)) {
            mesh.addObscurationTriangle(new Triangle(this.pointsMap[f[0]], this.pointsMap[f[1]], this.pointsMap[f[2]]).transform(transf));
            mesh.addObscurationTriangle(new Triangle(this.pointsMap[f[0]], this.pointsMap[f[2]], this.pointsMap[f[3]]).transform(transf));
        }
    }

    parseCommands() {
        let commands = this.xmlParsed.querySelectorAll("geogebra > construction > command");
        for (let command of commands) {
            switch (command.getAttribute("name")) {
                case "Cube": {
                    console.log("Got a cube");
                    this.parseCube(command);
                    break;
                }

                default: {
                    console.log(`Warning: unknown GeoGebra command ${command.getAttribute("name")}`);
                    break;
                }

            }
        }
    }
}

function getTetrahedronPoints(mesh) {
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

    let transf = math.identity(4);
    mesh.addObscurationTriangle(new Triangle(point0, point1, point2).transform(transf));
    mesh.addObscurationTriangle(new Triangle(point1, point2, point3).transform(transf));
    mesh.addObscurationTriangle(new Triangle(point2, point3, point0).transform(transf));
    mesh.addObscurationTriangle(new Triangle(point0, point1, point3).transform(transf));

    mesh.addPoint(point0);
    mesh.addPoint(point1);
    mesh.addPoint(point2);
    mesh.addPoint(point3);

    console.log(JSON.stringify(math.matrix(point0), math.replacer));

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
        this.obscurationTriangles = [];
        this.transformedLines = [];
        this.points = [];

        this.pos = math.matrix([0, 10, 10, 1]);
        this.pos = math.matrix([0, 0, 20, 1]);

        this.pitch = 0;
        this.yaw = 0;

        this.frame = 0;

        this.focus = math.matrix([0.0, 0.0, 0.0, 1.0]);
        this.obscurationWorker = new Worker("lineObscurationWorker.js");

        const currMesh = this;
        this.obscurationWorker.onmessage = function (e) {
            currMesh.receiveObscuredLines(e.data);
            currMesh.launchObscurationWorker();
        }
        this.obscurationWorker.onerror = function (e) {
            console.log("Error in obscurationworker: " + e.message);
            console.log(`At line ${e.lineno} of ${e.filename}`);
        }
        this.isObscurationWorkerRunning = false;
    }

    launchObscurationWorker() {
        this.isObscurationWorkerRunning = true;
        this.obscurationWorker.postMessage(this.serializeObscurationInput());
    }

    faceFocus() {
        let diff = math.subtract(this.focus, this.pos);
        diff = math.divide(diff, math.norm(diff));

        this.pitch = -Math.asin(diff.subset(math.index(1)));
        //this.yaw = Math.sign(diff.subset(math.index(0))) * Math.acos(diff.subset(math.index(2)) / Math.cos(this.pitch));
        diff = diff.subset(math.index(1), 0.0)
        let n = math.norm(diff);
        if (n > 1e-6) {
            diff = math.divide(diff, n);
            this.yaw = Math.sign(diff.subset(math.index(0))) * Math.acos(-diff.subset(math.index(2)))
        } else {
            this.yaw = 0.0;
        }
    }

    addPoint(p) {
        this.points.push(p);
    }

    addObscurationTriangle(tr) {
        this.obscurationTriangles.push(tr);
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
                [0, 0, 1, 1],
                [0, 0, Math.sin(halfFOVAngle), 0]
            ]
        );

        this.matrixToViewPort = math.multiply(this.projectionMatrix, this.viewMatrix);

        this.frame += 1;
        let recalculateObscuration = (frame % 30) == 1;
        recalculateObscuration = false;

        if (!this.isObscurationWorkerRunning) {
            this.launchObscurationWorker();
        }

        if (recalculateObscuration) {
            this.recalculateObscuration();
        } else {
            for (let l of this.transformedLines) {
                l.from = this.toViewspace(l.origFrom);
                l.to = this.toViewspace(l.origTo);
            }
        }

    }

    serializeObscurationInput() {
        let serialized = {};
        serialized.lines = this.lines;
        serialized.viewMatrix = JSON.stringify(this.viewMatrix, math.replacer);
        serialized.projectionMatrix = JSON.stringify(this.projectionMatrix, math.replacer);
        serialized.obscurationTriangles = [];
        for (let tr of this.obscurationTriangles) {
            serialized.obscurationTriangles.push(tr.serialize());
        }
        return serialized;
    }

    receiveObscuredLines(obj) {
        //console.log(`Received: ${JSON.stringify(obj)}`);

        let newObscuredLines = [];

        for (let l of obj) {
            newObscuredLines.push(ObscuredLine.deserialize(l));
        }
        //console.log(`newObscuredLines = ${newObscuredLines}`);
        this.transformedLines = newObscuredLines;
    }

    recalculateObscuration() {
        this.transformedLines = calculateObscuredLines(this); 
        // let serObscuredLines = calculateObscuredLines(this);
        // console.log(`Received: ${serObscuredLines}`);

        // let newObscuredLines = [];

        // for (let l of serObscuredLines) {
        //     newObscuredLines.push(ObscuredLine.deserialize(l));
        // }

        // this.transformedLines = newObscuredLines;

        // const minZ = 1e-12;

        // this.newTransformedLines = [];
        // for (let l of this.lines) {
        //     let outputDesc = {};
        //     outputDesc.from = this.toViewspace(l[0]);
        //     outputDesc.to = this.toViewspace(l[1]);

        //     let behindCount = (outputDesc.from.subset(math.index(2)) > -minZ) +
        //         (outputDesc.to.subset(math.index(2)) > -minZ);

        //     if (behindCount == 2) {
        //         continue;
        //     } else if (behindCount == 1) {
        //         if (outputDesc.from.subset(math.index(2)) > -minZ) {
        //             let swap = outputDesc.from;
        //             outputDesc.from = outputDesc.to;
        //             outputDesc.to = swap;
        //         }

        //         let fromZ = outputDesc.from.subset(math.index(2)) + minZ;
        //         let toZ = outputDesc.to.subset(math.index(2)) + minZ;

        //         let frac = -fromZ / (toZ - fromZ);
        //         outputDesc.to = math.add(math.multiply(math.subtract(outputDesc.to, outputDesc.from), frac), outputDesc.from);
        //     }

        //     let obscuredLine = new ObscuredLine(outputDesc.from, outputDesc.to);
        //     obscuredLine.origFrom = l[0];
        //     obscuredLine.origTo = l[1];

        //     for (let tr of this.obscurationTriangles) {
        //         obscuredLine.obscureByTriangle(tr.transform(math.transpose(this.viewMatrix)), math.transpose(this.projectionMatrix));
        //     }

        //     // outputDesc.from = this.toProjectedSpace(outputDesc.from);
        //     // outputDesc.to = this.toProjectedSpace(outputDesc.to);

        //     // let coords = [];
        //     // for (let coord of l) {
        //     //     coords.push(this.toViewport(coord));
        //     // }
        //     // this.transformedLines.push(coords);
        //     this.newTransformedLines.push(obscuredLine);
        // }
        // this.transformedLines = this.newTransformedLines;
    }

    updateRender() {
        if (this.el != null) {
            this.el.remove();
            this.el = null;
        }

        this.el = document.createElementNS("http://www.w3.org/2000/svg", "g");
        for (let l of this.transformedLines) {
            let to = this.toProjectedSpace(l.from);
            let from = this.toProjectedSpace(l.from);
            let obscured = true;

            l.obscurationSwitches.push(1);
            for (let s of l.obscurationSwitches) {
                from = to;
                //to = math.add(math.multiply(math.subtract(l.to, l.from), s), l.from);
                to = this.toProjectedSpace(l.getAtProgr(s));

                obscured = !obscured;

                let lineEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
                lineEl.style.strokeWidth = 0.8;

                if (obscured) {
                    lineEl.style.stroke = "black";
                    // lineEl.style.stroke = "red";
                    lineEl.style.strokeDasharray = "2 2";
                } else {
                    lineEl.style.stroke = "black";
                }
                // lineEl.setAttribute("d", `M ${l[0].subset(math.index(0))} ${l[0].subset(math.index(1))} L ${l[1].subset(math.index(0))} ${l[1].subset(math.index(1))}`);
                lineEl.setAttribute("d", `M ${from.subset(math.index(0))} ${from.subset(math.index(1))} ` +
                    `L ${to.subset(math.index(0))} ${to.subset(math.index(1))}`);

                this.el.appendChild(lineEl);
            }

            // let lineEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            // lineEl.style.stroke = "black";
            // lineEl.style.strokeWidth = 0.8;
            // // lineEl.setAttribute("d", `M ${l[0].subset(math.index(0))} ${l[0].subset(math.index(1))} L ${l[1].subset(math.index(0))} ${l[1].subset(math.index(1))}`);
            // lineEl.setAttribute("d", `M ${l.from.subset(math.index(0))} ${l.from.subset(math.index(1))} ` + 
            // `L ${l.to.subset(math.index(0))} ${l.to.subset(math.index(1))}`);

            // this.el.appendChild(lineEl);
        }

        for (let p of this.points) {
            let circleEl = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            let transformedP = this.toViewport(p);

            circleEl.style.r = `1px`;
            circleEl.style.cx = `${-transformedP.subset(math.index(0))}px`;
            circleEl.style.cy = `${-transformedP.subset(math.index(1))}px`;

            circleEl.style.fill = "black";

            // // lineEl.setAttribute("d", `M ${l[0].subset(math.index(0))} ${l[0].subset(math.index(1))} L ${l[1].subset(math.index(0))} ${l[1].subset(math.index(1))}`);
            // lineEl.setAttribute("d", `M ${from.subset(math.index(0))} ${from.subset(math.index(1))} ` +
            //     `L ${to.subset(math.index(0))} ${to.subset(math.index(1))}`);

            this.el.appendChild(circleEl);
        }

        $("#viewport")[0].appendChild(this.el);
    }

    update() {
        this.updateTransformation();
        this.updateRender();
    }
}

let mesh = null;

let frame = 0;

const listenKeys = ["Space", "Shift", "KeyW", "KeyA", "KeyS", "KeyD", "Numpad6", "Numpad4", "Numpad8", "Numpad2"];
let keyStates = {};

let targetFPS = 30;

function update() {
    frame += 1;
    let speed = 4;

    if (useRepeatingAntiGhost) {
        let nowTimestamp = new Date().getTime();

        for (let a in keyStates) {
            if (keyStates[a] && nowTimestamp > keyStates[a][1])
                keyStates[a] = null;
        }
    }

    if (keyStates["Space"]) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [0, speed / targetFPS, 0, 0]));
        //mesh.pos[1] = mesh.pos[1] + speed / targetFPS;
    } else if (keyStates["Shift"]) {
        //mesh.pos[1] = mesh.pos[1] - speed / targetFPS;
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [0, -speed / targetFPS, 0, 0]));
    }

    if (keyStates["KeyW"]) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [0, 0, -speed / targetFPS, 0]));
        //mesh.pos[2] = mesh.pos[2] + speed / targetFPS;
    } else if (keyStates["KeyS"]) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [0, 0, speed / targetFPS, 0]));
        //mesh.pos[2] = mesh.pos[2] - speed / targetFPS;
    }

    if (keyStates["KeyD"]) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [speed / targetFPS, 0, 0, 0]));
        //mesh.pos[0] = mesh.pos[0] + speed / targetFPS;
    } else if (keyStates["KeyA"]) {
        mesh.pos = math.add(mesh.pos, math.multiply(mesh.viewInverse, [-speed / targetFPS, 0, 0, 0]));
        //mesh.pos[0] = mesh.pos[0] - speed / targetFPS;
    }

    if (keyStates["Numpad6"]) {
        mesh.yaw += Math.PI / (2 * targetFPS);
    } else if (keyStates["Numpad4"]) {
        mesh.yaw -= Math.PI / (2 * targetFPS);
    }

    if (keyStates["Numpad2"]) {
        mesh.pitch += Math.PI / (2 * targetFPS);
    } else if (keyStates["Numpad8"]) {
        mesh.pitch -= Math.PI / (2 * targetFPS);
    }

    if (isFocusToggled)
        mesh.faceFocus();

    if ((frame % (5 * targetFPS)) === 0) {
        //console.log(`x=${mesh.pos[0].toFixed(2)}, y=${mesh.pos[1].toFixed(2)}, z=${mesh.pos[2].toFixed(2)}`);
        console.log(`x=${mesh.pos.subset(math.index(0)).toFixed(2)}, ` +
            `y=${mesh.pos.subset(math.index(1)).toFixed(2)}, ` +
            `z=${mesh.pos.subset(math.index(2)).toFixed(2)}`);
    }

    mesh.update();
}

const useRepeatingAntiGhost = false;

function onDOMReady() {
    // let el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // el.style.stroke = "black";
    // el.style.strokeWidth = 6;
    // el.setAttribute("d", "M 0 0 L 70 70");

    //$("#viewport")[0].appendChild(el);

    mesh = new Mesh();
    mesh.update();

    getTetrahedronPoints(mesh);

    mesh.update();

    window.setInterval(() => { update(); }, 1000 / targetFPS);

    $("body")[0].addEventListener("keydown", function (e) {
        let isRelevant = true;
        let nowTimestamp = new Date().getTime();

        let id = e.code;
        if (!listenKeys.includes(id))
            id = e.key;
        if (listenKeys.includes(id)) {
            let val = keyStates[id];
            if (val) {
                let delta = nowTimestamp - val[0];
                keyStates[id] = [nowTimestamp, nowTimestamp + 5 * delta];
            } else {
                keyStates[id] = [nowTimestamp, Infinity];
                console.log(`Key ${id} down`);
                console.log(`  ${keyStates}`);
            }

            e.preventDefault();
            e.stopPropagation();
        }
    });

    $("body")[0].addEventListener("keyup", function (e) {
        let id = e.code;
        if (!listenKeys.includes(id))
            id = e.key;
        if (listenKeys.includes(id)) {
            keyStates[id] = null;

            console.log(`Key ${id} up`);
            console.log(`  ${keyStates}`);

            e.preventDefault();
            e.stopPropagation();
        }
    });
}

