"use strict";

class ObscuredLine {
    constructor(from, to) {
        this.from = from;
        this.to = to;
        this.obscurationSwitches = [];
        this.obscurePart(0.2, 0.6);
        this.obscurePart(0.6, 0.9);
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

}

