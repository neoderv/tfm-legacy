import { tiles } from './tiles.js';

const MAX_STACK = 100;
const MAX_SLOTS = 36;
const MAX_HOTBAR = 9;

let inv = [];
let recipesOut = [];
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

let expandInv = (show) => {
    inv.forEach((item, slot) => {
        let outer = document.querySelector(`#outer-${slot}`);
        if (slot >= MAX_HOTBAR && !show) {
            outer.style.display = 'none';
        } else {
            outer.style.display = 'block';
        }
    })
}


let updateInventory = (show) => {
    inv.forEach((item, slot) => {
        let outer = document.querySelector(`#outer-${slot}`);

        if (slot == selected) {
            outer.classList.add('selected')
        } else {
            outer.classList.remove('selected')
        }
        
        document.querySelector(`#slot-${slot}`).textContent = item.amount ? item.amount : '';
        document.querySelector(`#tooltip-${slot}`).textContent = item.amount ? tiles[item.type].name + '\n' + tiles[item.type].desc : '';
        document.querySelector(`#tooltip-${slot}`).style.display = (slot == selected && item.amount) ? 'block' : 'none';
        let tileName = (tiles[item.type] && item.amount) ? tiles[item.type].texture : 'air';
        document.querySelector(`#inner-${slot}`).src = (item.type) ? `./tile/${tileName}.png` : './tile/air.png';
    })
    addRecipes(recipesOut);
}

let selectSlot = (slot) => {
    if (!slot) return selected;
    selected = slot;
    updateInventory();
}

let addRecipes = (recipes) => {
    for (let i = 0; i < 9; i++) {
        let item = recipes[i] ? recipes[i].output : false;
        let recipe = recipes[i] ? recipes[i].input : [];

        let outer = document.querySelector(`#couter-${i}`);

        if (-1 - i == selected) {
            outer.classList.add('selected')
        } else {
            outer.classList.remove('selected')
        }

        let recipeText = '';
        for (let slot of recipe) {
            recipeText += `${slot.amount}x ${tiles[slot.type].name}, `;
        }

        document.querySelector(`#ctooltip-${i}`).textContent = item ? tiles[item].name + '\n' + recipeText : '';
        document.querySelector(`#ctooltip-${i}`).style.display = (item && -1 - i == selected) ? 'block' : 'none';

        let tileName = (tiles[item]) ? tiles[item].texture : 'air';
        document.querySelector(`#cinner-${i}`).src = (item) ? `./tile/${tileName}.png` : './tile/air.png';
    }
    recipesOut = recipes;
}

let invObj = document.querySelector('#inventory');
for (let i = 0; i < MAX_SLOTS; i++) {
    inv[i] = {};
    invObj.innerHTML += `<div class='slot' id='outer-${i}'><img class='slot-img' id='inner-${i}'><span id='slot-${i}'></span><span id='tooltip-${i}' class='tooltip'></span></div>`
}

for (let i = 0; i < 9; i++) {
    invObj.innerHTML += `<div class='slot crafter' id='couter-${i}'><img class='slot-img' id='cinner-${i}'><span id='cslot-${i}'></span><span id='ctooltip-${i}' class='tooltip'></span></div>`
}

for (let i = 0; i < MAX_SLOTS; i++) {
    invObj.querySelector(`#outer-${i}`).addEventListener('click', (e) => {
        selected = i;
        updateInventory();
    })
}

for (let i = 0; i < 9; i++) {
    invObj.querySelector(`#couter-${i}`).addEventListener('click', (e) => {
        selected = -1 - i;
        updateInventory();
    })
}

export {
    addInventory,
    selectSlot,
    getInventory,
    setInventory,
    expandInv,
    addRecipes
}