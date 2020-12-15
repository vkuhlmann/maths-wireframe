"use strict";

function calculateObscuredLines(obj) {
    const minZ = 1e-12;

    let newTransformedLines = [];
    for (let l of obj.lines) {
        let outputDesc = {};
        outputDesc.from = obj.toViewspace(l[0]);
        outputDesc.to = obj.toViewspace(l[1]);

        let behindCount = (outputDesc.from.subset(math.index(2)) > -minZ) +
            (outputDesc.to.subset(math.index(2)) > -minZ);

        if (behindCount == 2) {
            continue;
        } else if (behindCount == 1) {
            if (outputDesc.from.subset(math.index(2)) > -minZ) {
                let swap = outputDesc.from;
                outputDesc.from = outputDesc.to;
                outputDesc.to = swap;
            }

            let fromZ = outputDesc.from.subset(math.index(2)) + minZ;
            let toZ = outputDesc.to.subset(math.index(2)) + minZ;

            let frac = -fromZ / (toZ - fromZ);
            outputDesc.to = math.add(math.multiply(math.subtract(outputDesc.to, outputDesc.from), frac), outputDesc.from);
        }

        let obscuredLine = new ObscuredLine(outputDesc.from, outputDesc.to);
        obscuredLine.origFrom = l[0];
        obscuredLine.origTo = l[1];

        for (let tr of obj.obscurationTriangles) {
            obscuredLine.obscureByTriangle(tr.transform(math.transpose(obj.viewMatrix)), math.transpose(obj.projectionMatrix));
        }

        // outputDesc.from = this.toProjectedSpace(outputDesc.from);
        // outputDesc.to = this.toProjectedSpace(outputDesc.to);

        // let coords = [];
        // for (let coord of l) {
        //     coords.push(this.toViewport(coord));
        // }
        // this.transformedLines.push(coords);
        newTransformedLines.push(obscuredLine);
    }
    return newTransformedLines;
}

function normalizeW(v) {
    return v.subset(math.index(3)) !== 0 ? math.divide(v, v.subset(math.index(3))) : math.matrix([100, 0, 0, 1]);
}

class Triangle {
    constructor(p0, p1, p2) {
        if (p1 === undefined) {
            this[0] = JSON.parse(p0["0"], math.reviver);
            this[1] = JSON.parse(p0["1"], math.reviver);
            this[2] = JSON.parse(p0["2"], math.reviver);

        } else {
            this[0] = normalizeW(math.matrix(p0).resize([4], 1));
            this[1] = normalizeW(math.matrix(p1).resize([4], 1));
            this[2] = normalizeW(math.matrix(p2).resize([4], 1));
        }
        this.length = 3;
    }

    serialize() {
        return {
            "0": JSON.stringify(this[0], math.replacer), 
            "1": JSON.stringify(this[1], math.replacer),
            "2": JSON.stringify(this[2], math.replacer)
        };
    }

    static deserialize(s) {
        return new Triangle(s);
    }


    transform(m) {
        return new Triangle(
            math.multiply(this[0], m),
            math.multiply(this[1], m),
            math.multiply(this[2], m)
        );
    }

    skewZToZero() {
        let tr1 = math.subtract(this[1], this[0]);
        let tr2 = math.subtract(this[2], this[0]);

        let triangleFlatDir1 = math.dotMultiply(tr1, math.matrix([1.0, 1.0, 0.0, 1.0]));

        let rightAngleFraction = math.divide(math.dot(tr2, triangleFlatDir1),
            math.dot(triangleFlatDir1, triangleFlatDir1));
        let rightAnglePoint = math.multiply(triangleFlatDir1, rightAngleFraction);

        let triangleFlatDir2 = math.dotMultiply(math.subtract(tr2, rightAnglePoint), [1.0, 1.0, 0.0, 1.0]);

        let slope = math.multiply(triangleFlatDir1, math.dot(tr1, [0.0, 0.0, 1.0, 0.0])
            / math.dot(triangleFlatDir1, triangleFlatDir1));

        slope = math.add(slope, math.multiply(triangleFlatDir2, (
            math.dot(tr2, [0.0, 0.0, 1.0, 0.0])
            - math.dot(slope, tr1) * rightAngleFraction) /
            math.dot(triangleFlatDir2, triangleFlatDir2)));

        let corr = math.subtract(math.matrix([0.0, 0.0, 1.0, 0.0]), slope);

        let originZ = -math.dot(this[0], corr);

        return math.transpose(math.matrix([
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0],
            math.add(corr, math.multiply(originZ, math.matrix([0.0, 0.0, 0.0, 1.0]))),
            [0.0, 0.0, 0.0, 1.0]
        ]));
    }
}

class Line {
    constructor(from, to, isFromBounded, isToBounded) {
        this.from = math.matrix(from);
        this.to = math.matrix(to);

        this.from = math.divide(this.from, this.from.subset(math.index(3)));
        this.to = math.divide(this.to, this.to.subset(math.index(3)));

        this.isFromBounded = isFromBounded;
        this.isToBounded = isToBounded;
    }

    serialize() {
        return {from: JSON.stringify(this.from, math.replacer), 
            to: JSON.stringify(this.to, math.replacer),
            isFromBounded: this.isFromBounded,
            isToBounded: this.isToBounded};
    }

    static deserialize(obj) {
        return new Line(
            JSON.parse(obj.from, math.reviver), 
            JSON.parse(obj.to, math.reviver), 
            obj.isFromBounded, obj.isToBounded);
    }

    static Bounded(from, to) {
        return new Line(from, to, true, true);
    }

    static Unbounded(from, to) {
        return new Line(from, to, false, false);
    }

    transform(m) {
        return new Line(
            math.multiply(this.from, m),
            math.multiply(this.to, m),
            this.isFromBounded,
            this.isToBounded
        );
    }

    find2DIntersection(oth) {
        let othDir = math.dotMultiply(math.subtract(oth.to, oth.from), [1.0, 1.0, 0.0, 1.0]);

        let dir = math.dotMultiply(math.subtract(this.to, this.from), [1.0, 1.0, 0.0, 1.0]);
        dir = math.divide(dir, math.dot(dir, dir));

        let basePoint = math.subtract(oth.from, this.from);

        const rotatePerp = math.matrix([
            [0.0, -1.0, 0.0, 0.0],
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ]);

        let perp = math.multiply(dir, rotatePerp);

        let perpDispl = -math.dot(basePoint, perp);
        let perpDir = math.dot(othDir, perp);

        if (perpDir == 0.0)
            return Infinity;

        const epsilon = 1e-4;

        let p = perpDispl / perpDir;
        if ((p < 0.0 - epsilon && oth.isFromBounded)
            || (p > 1.0 + epsilon && oth.isToBounded)
            || p == Infinity || p == -Infinity) {
            return Infinity;
        }

        let along = math.dot(math.add(basePoint, math.multiply(othDir, p)), dir);
        if ((this.isFromBounded && along < 0.0 - epsilon)
            || (this.isToBounded && along > 1.0 + epsilon)) {
            return Infinity;
        }
        return along;
    }

    getAtProgr(p) {
        return math.add(this.from, math.multiply(math.subtract(this.to, this.from),
            p));
    }

    getBehindTriangle(tr) {
        const thresh = 1e-4;
        if ((math.dot(math.subtract(tr[0], this.from), math.subtract(tr[0], this.from)) <= thresh
            || math.dot(math.subtract(tr[1], this.from), math.subtract(tr[1], this.from)) <= thresh
            || math.dot(math.subtract(tr[2], this.from), math.subtract(tr[2], this.from)) <= thresh)
            && (math.dot(math.subtract(tr[0], this.to), math.subtract(tr[0], this.to)) <= thresh
                || math.dot(math.subtract(tr[1], this.to), math.subtract(tr[1], this.to)) <= thresh
                || math.dot(math.subtract(tr[2], this.to), math.subtract(tr[2], this.to)) <= thresh))
            return [Infinity, Infinity];

        let skewZToZero = tr.skewZToZero();

        let v0 = math.multiply(tr[0], skewZToZero);
        let v1 = math.multiply(tr[1], skewZToZero);
        let v2 = math.multiply(tr[2], skewZToZero);

        let prevFromBounded = this.isFromBounded;
        let prevToBounded = this.isToBounded;

        this.isFromBounded = false;
        this.isToBounded = false;

        let intersect1 = this.find2DIntersection(Line.Bounded(tr[0], tr[1]));
        let intersect2 = this.find2DIntersection(Line.Bounded(tr[0], tr[2]));
        let intersect3 = this.find2DIntersection(Line.Bounded(tr[1], tr[2]));

        this.isFromBounded = prevFromBounded;
        this.isToBounded = prevToBounded;

        if ((intersect1 != Infinity) + (intersect2 != Infinity) + (intersect3 != Infinity) < 2)
            return [Infinity, Infinity];

        if (intersect1 === Infinity)
            intersect1 = intersect3;

        if (intersect2 === Infinity)
            intersect2 = intersect3;

        let minIntersect = math.min(intersect1, intersect2);
        let maxIntersect = math.max(intersect1, intersect2);

        if (intersect3 != Infinity) {
            minIntersect = math.min(minIntersect, intersect3);
            maxIntersect = math.max(maxIntersect, intersect3);
        }

        //if ((std::max<float>(intersect1, intersect2) <= 0.0f && m_isFromBounded)
        //    || (std::min<float>(intersect1, intersect2) >= 1.0f && m_isToBounded))
        //    return std::make_pair(INFINITY, INFINITY);

        if ((maxIntersect <= 0.0 && this.isFromBounded)
            || (minIntersect >= 1.0 && this.isToBounded))
            return [Infinity, Infinity];

        if (this.isFromBounded) {
            minIntersect = math.max(minIntersect, 0.0);
            maxIntersect = math.max(maxIntersect, minIntersect);
            //intersect1 = std::max(0.0f, intersect1);
            //intersect2 = std::max(0.0f, intersect2);

        }

        if (this.isToBounded) {
            maxIntersect = math.min(maxIntersect, 1.0);
            minIntersect = math.min(minIntersect, maxIntersect);
            //intersect1 = std::min(1.0f, intersect1);
            //intersect2 = std::min(1.0f, intersect2);
        }

        if (maxIntersect < minIntersect + 1e-4)
            return [Infinity, Infinity];
        //intersect1 = std::max(0.0f, std::min(1.0f, intersect1));
        //intersect2 = std::max(0.0f, std::min(1.0f, intersect2));

        let point1 = math.multiply(this.getAtProgr(minIntersect), skewZToZero);
        let point2 = math.multiply(this.getAtProgr(maxIntersect), skewZToZero);

        let point1Z = math.dot(point1, [0.0, 0.0, 1.0, 0.0]);
        let point2Z = math.dot(point2, [0.0, 0.0, 1.0, 0.0]);

        const epsilon = 0.0;

        if (point1Z > epsilon && point2Z > epsilon)
            return [minIntersect, maxIntersect];

        if (point1Z <= epsilon && point2Z <= epsilon)
            return [Infinity, Infinity];

        let slide = -point1Z / (point2Z - point1Z);

        return [minIntersect + slide * (maxIntersect - minIntersect),
        (point1Z > 0.0) ? minIntersect : maxIntersect];
    }
}

class ObscuredLine extends Line {
    constructor(from, to, isFromBounded = true, isToBounded = true) {
        super(from, to, isFromBounded, isToBounded);
        this.obscurationSwitches = [];
    }

    serialize() {
        let obj = super.serialize();
        obj.obscurationSwitches = [...this.obscurationSwitches];
        obj.origFrom = (this.origFrom != null) ? JSON.stringify(this.origFrom, math.replacer) : null;
        obj.origTo = (this.origTo != null) ? JSON.stringify(this.origTo, math.replacer) : null;
        return obj;
    }

    static deserialize(obj) {
        let ans = new ObscuredLine(
            JSON.parse(obj.from, math.reviver), 
            JSON.parse(obj.to, math.reviver), 
            obj.isFromBounded, obj.isToBounded);
        ans.obscurationSwitches = [...obj.obscurationSwitches];
        ans.origFrom = (obj.origFrom != null) ? JSON.parse(obj.origFrom, math.reviver) : null;
        ans.origTo = (obj.origTo != null) ? JSON.parse(obj.origTo, math.reviver) : null;
        return ans;
    }

    obscurePart(p1, p2) {
        let from = Math.max(Math.min(p1, p2), 0.0);
        let to = Math.min(Math.max(p1, p2), 1.0);

        if (to - from < 1e-3)
            return;

        let indexFrom = 0;
        for (; indexFrom < this.obscurationSwitches.length; indexFrom++) {
            if (this.obscurationSwitches[indexFrom] >= from)
                break;
        }

        let indexTo = 0;
        for (; indexTo < this.obscurationSwitches.length; indexTo++) {
            if (this.obscurationSwitches[indexTo] > to)
                break;
        }

        let addValues = [];
        if ((indexFrom % 2) === 0)
            addValues.push(from);
        if ((indexTo % 2) === 0)
            addValues.push(to);
        this.obscurationSwitches.splice(indexFrom, indexTo - indexFrom, ...addValues);
    }

    obscureByTriangle(tr, transf) {
        let intersect = this.transform(transf).getBehindTriangle(tr.transform(transf));
        if (intersect[0] !== Infinity) {
            let p1 = this.transform(transf).getAtProgr(intersect[0]);
            let p2 = this.transform(transf).getAtProgr(intersect[1]);

            let invTransf = math.inv(transf);
            p1 = math.multiply(p1, invTransf);
            p1 = math.divide(p1, p1.subset(math.index(3)));

            p2 = math.multiply(p2, invTransf);
            p2 = math.divide(p2, p2.subset(math.index(3)));

            let dir = math.subtract(this.to, this.from);
            dir = math.divide(dir, math.dot(dir, dir));

            let progr1 = math.dot(math.subtract(p1, this.from), dir);
            let progr2 = math.dot(math.subtract(p2, this.from), dir);

            this.obscurePart(progr1, progr2);
        }
    }

    // setProjection(transf) {
    //     this.fromProjected = math.multiply(this.from, transf);
    //     this.fromProjected = math.divide(this.fromProjected, this.fromProjected.subset(math.index(3)));

    //     this.toProjected = math.multiply(this.to, transf);
    //     this.toProjected = math.divide(this.toProjected, this.toProjected.subset(math.index(3)));

    //     let dir = math.subtract(this.toProject, this.fromProjected);
    //     dir = math.divide(dir, math.dot(dir, dir));

    //     this.fullLines = [];
    //     this.dashedLines = [];

    //     let to = this.from;
    //     let from = this.from;
    //     let obscured = true;

    //     this.obscurationSwitches.push(1.0);
    //     for (let s of this.obscurationSwitches) {
    //         from = to;
    //         to = math.add(math.multiply(math.subtract(l.to, l.from), s), l.from);
    //         obscured = !obscured;

    //         let lineEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    //         lineEl.style.strokeWidth = 0.8;

    //         if (obscured) {
    //             lineEl.style.stroke = "red";
    //             lineEl.style.strokeDasharray = "2 2";
    //         } else {
    //             lineEl.style.stroke = "black";
    //         }
    //         // lineEl.setAttribute("d", `M ${l[0].subset(math.index(0))} ${l[0].subset(math.index(1))} L ${l[1].subset(math.index(0))} ${l[1].subset(math.index(1))}`);
    //         lineEl.setAttribute("d", `M ${from.subset(math.index(0))} ${from.subset(math.index(1))} ` +
    //             `L ${to.subset(math.index(0))} ${to.subset(math.index(1))}`);

    //         this.el.appendChild(lineEl);
    //     }
    // }

}

