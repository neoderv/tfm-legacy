
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { RECIPES } from './recipes.js';

const MAX_STACK = 100;
const MAX_SLOTS = 36;
const prefix = `${process.cwd()}/db/world`;

class Inventory {

    constructor(socket, id, world) {
        this.inv = [];
        this.socket = socket;
        this.prefix = `${prefix}/${world}/players/${id}.json`
        this.pos = [0,0];
        this.health = 100;
    }

    getRecipes() {
        let validRecipes = [];

        for (let recipe of RECIPES) {
            let input = recipe.input;

            let valid = true;

            for (let {type, amount} of input) {
                let invItems = this.inv.filter(x => x.type == type && x.amount >= amount);
                if (!invItems || invItems.length < 1) {
                    valid = false;
                    break;
                }
            }

            if (valid) validRecipes.push(recipe);
        }

        return validRecipes;
    }

    async updateInventory() {
        if (this.inv.length == 0) {
            try {
                let data = await readFile(this.prefix, 'utf8');
                this.inv = JSON.parse(data).inv || JSON.parse(data);
                this.pos = JSON.parse(data).pos || [0,-10]
                this.health = JSON.parse(data).health || 100
            } catch (err) {
                this.inv = [];
                this.pos = [0,-10];
                this.health = 100;
            }
        }
        for (let i = this.inv.length; i < MAX_SLOTS; i++) {
            this.inv[i] = {};
        }

        await writeFile(this.prefix, JSON.stringify({
            inv: this.inv,
            pos: this.pos,
            health: this.health
        }), 'utf8');
        this.socket.emit('inventory', this.inv);
        this.socket.emit('health', this.health);
        this.socket.emit('recipes', this.getRecipes());
        return;
    }

    addInventory(item) {
        let firstSlot = this.inv.findIndex((elem) => {
            return elem.type == item && elem.amount < MAX_STACK
        })

        let firstEmpty = this.inv.findIndex((elem) => {
            return !elem.type || !elem.amount
        })

        if (firstSlot != -1) {
            this.inv[firstSlot].amount++;
        }

        if (firstSlot == -1 && firstEmpty != -1) {
            this.inv[firstEmpty] = {
                type: item,
                amount: 1
            }
        }

        this.updateInventory();
    }

    removeInventory(slot) {
        if (slot > MAX_SLOTS) return;

        if (slot < 0) {
            let recipe = this.getRecipes()[-1 - slot];
            if (!recipe) return;

            for (let item of recipe.input) {
                let i = this.inv.findIndex(x => x.type == item.type && x.amount >= item.amount);

                if (i == -1) return;
                
                console.log(item.amount)

                this.inv[i].amount -= item.amount;
            }
            this.addInventory(recipe.output);
            return;
        }

        if (this.inv[slot].amount > 0) {
            this.inv[slot].amount--;
            this.updateInventory();
            return this.inv[slot].type;
        }
    }

    async healthAdd(amount) {
        this.health += amount;

        if (this.health < 1) {
            this.pos = [0,-10];
            this.health = 100;
            this.socket.emit('health', this.health);
            return true;
        }
        this.socket.emit('health', this.health);
        return false;
    }

    getInventory() {
        return this.inv;
    }

    updatePos(pos) {
        this.pos = pos;
        this.updateInventory();
    }
}

export {
    Inventory
}