"use strict";

importScripts("math.js", "obscuration.js");

function deserializeObscurationInput(s) {
    let obj = s;
    obj.viewMatrix = JSON.parse(obj.viewMatrix, math.reviver);
    obj.projectionMatrix = JSON.parse(obj.projectionMatrix, math.reviver);

    let triangles = [];
    for (let serTr of obj.obscurationTriangles) {
        triangles.push(Triangle.deserialize(serTr));
    }
    obj.obscurationTriangles = triangles;

    obj.toViewspace = function(vec) {
        let v = math.multiply(this.viewMatrix, math.matrix(vec).resize([4], 1));
        v = math.multiply(v, 1.0 / Math.abs(v.subset(math.index(3))));
        return v;
    }

    return obj;
}

// function calculateObscuredLines(mesh) {
//     mesh.recalculateObscuration();
//     return mesh.transformedLines;
// }

onmessage = function(e) {
    console.log("Recalculating...");
    //console.log(`e.data = ${JSON.stringify(e.data)}`);
    //let ans = calculateObscuredLines(e.data);
    let deserialized = deserializeObscurationInput(e.data);
    //debugger;
    let ans = calculateObscuredLines(deserialized);
    //console.log(`ans = ${ans}`);
    let obscLines = [];
    for (let l of ans) {
        obscLines.push(l.serialize());
    }
    //console.log(`Answering \r\n${JSON.stringify(obscLines, null, 4)}`);
    postMessage(obscLines);
}
