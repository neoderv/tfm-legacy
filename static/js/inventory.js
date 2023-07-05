import { tiles } from './tiles.js';

const MAX_STACK = 100;
const MAX_SLOTS = 9;

let inv = [];
let selected = 0;

let addInventory = (item) => {
    let firstSlot = inv.findIndex((elem) => {
        return elem.type == item && elem.amount < MAX_STACK
    })

    let firstEmpty = inv.findIndex((elem) => {
        return !elem.type || !elem.amount
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

let getInventory = () => {
    return inv;
}

let setInventory = (invB) => {
    inv = invB;
    updateInventory();
}

let updateInventory = () => {
    inv.forEach((item, slot) => {
        let outer = document.querySelector(`#outer-${slot}`);
        if (slot == selected) {
            outer.classList.add('selected')
        } else {
            outer.classList.remove('selected')
        }
        
        document.querySelector(`#slot-${slot}`).textContent = item.amount ? item.amount : '';
        let tileName = (tiles[item.type] && item.amount) ? tiles[item.type].texture : 'air';
        document.querySelector(`#inner-${slot}`).src = (item.type) ? `./tile/${tileName}.png` : './tile/air.png';
    })
}

let selectSlot = (slot) => {
    selected = slot;
    updateInventory();
}

for (let i = 0; i < MAX_SLOTS; i++) {
    inv[i] = {};
    document.querySelector('#inventory').innerHTML += `<div class='slot' id='outer-${i}'><img class='slot-img' id='inner-${i}'><span id='slot-${i}'></span></div>`
}

export {
    addInventory,
    selectSlot,
    getInventory,
    setInventory
}