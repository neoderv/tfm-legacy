
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const MAX_STACK = 100;
const MAX_SLOTS = 36;
const prefix = `${process.cwd()}/db/world`;

class Inventory {

    constructor(socket, id, world) {
        this.inv = [];
        this.socket = socket;
        this.prefix = `${prefix}/${world}/players/${id}.json`
    }

    async updateInventory() {
        if (this.inv.length == 0) {
            try {
                let data = await readFile(this.prefix, 'utf8');
                this.inv = JSON.parse(data);
            } catch (err) {
                this.inv = [];
            }
        }
        for (let i = this.inv.length; i < MAX_SLOTS; i++) {
            this.inv[i] = {};
        }

        await writeFile(this.prefix, JSON.stringify(this.inv), 'utf8');
        this.socket.emit('inventory', this.inv);
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
        if (this.inv[slot].amount > 0) {
            this.inv[slot].amount--;
            this.updateInventory();
            return this.inv[slot].type;
        }

    }

    getInventory() {
        return this.inv;
    }
}

export {
    Inventory
}