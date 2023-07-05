import { tiles } from './tiles.js';

const MAX_STACK = 16;
const MAX_SLOTS = 9;

let inv = [];

let addInventory = (item) => {
    let firstSlot = inv.findIndex((elem) => {
        return elem.type == item && elem.amount < MAX_STACK
    })

    let firstEmpty = inv.findIndex((elem) => {
        return !elem.type && elem.type != 0
    })

    if (firstSlot != -1) {
        inv[firstSlot].amount++;
    }

    if (firstSlot == -1 && firstEmpty != -1) {
        inv[firstEmpty] = {
            type: item,
            amount: 1
        }
    }

    updateInventory();
}

let updateInventory = () => {
    inv.forEach((item, slot) => {
        document.querySelector(`#slot-${slot}`).textContent = item.amount;
        let tileName = tiles[item.type] ? tiles[item.type].texture : 'air';
        document.querySelector(`#inner-${slot}`).src = (item.type) ? `./tile/${tileName}.png` : './tile/air.png';
    })
}

for (let i = 0; i < MAX_SLOTS; i++) {
    inv[i] = {};
    document.querySelector('#inventory').innerHTML += `<div class='slot'><img class='slot-img' id='inner-${i}'><span id='slot-${i}'></span></div>`
}

export {
    addInventory
}