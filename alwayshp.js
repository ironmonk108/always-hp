import { registerSettings } from "./settings.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export let debug = (...args) => {
    if (debugEnabled > 1) console.log("DEBUG: alwayshp | ", ...args);
};
export let log = (...args) => console.log("alwayshp | ", ...args);
export let warn = (...args) => {
    if (debugEnabled > 0) console.warn("alwayshp | ", ...args);
};
export let error = (...args) => console.error("alwayshp | ", ...args);
export let i18n = key => {
    return game.i18n.localize(key);
};
export let setting = key => {
    return game.settings.get("always-hp", key);
};

export let patchFunc = (prop, func, type = "WRAPPER") => {
    let nonLibWrapper = () => {
        const oldFunc = eval(prop);
        eval(`${prop} = function (event) {
            return func.call(this, ${type != "OVERRIDE" ? "oldFunc.bind(this)," : ""} ...arguments);
        }`);
    }
    if (game.modules.get("lib-wrapper")?.active) {
        try {
            libWrapper.register("always-hp", prop, func, type);
        } catch (e) {
            nonLibWrapper();
        }
    } else {
        nonLibWrapper();
    }
}

export class AlwaysHP extends HandlebarsApplicationMixin(ApplicationV2) {
    tokenname = '';
    tokenstat = '';
    tokentemp = '';
    tokentooltip = '';
    color = "";
    valuePct = null;
    tempPct = null;

    static DEFAULT_OPTIONS = {
        id: "always-hp",
        classes: ["always-hp"],
        window: {
            resizable: false,
        },
        position: {
            width: 300
        }
    }

    static PARTS = {
        main: {
            root: true,
            template: "modules/always-hp/templates/alwayshp.html"
        }
    };

    nonDismissible = true;

    persistPosition = foundry.utils.debounce(this.onPersistPosition.bind(this), 1000);

    _initializeApplicationOptions(options) {
        options = super._initializeApplicationOptions(options);
        if (setting("allow-fade"))
            options.classes.push("faded-ui");

        let pos = game.user.getFlag("always-hp", "alwayshpPos");
        options.position.top = pos?.top || 60;
        options.position.left = pos?.left || ($('#board').width() / 2 - 150);

        return options;
    }

    async _renderFrame(options) {
        const frame = await super._renderFrame(options);

        const header_html = await foundry.applications.handlebars.renderTemplate("modules/always-hp/templates/alwayshp-header.html", this);

        $('.window-header', frame)
            .empty()
            .addClass('flexrow')
            .append(header_html);
        
        return frame;
    }

    setPosition(position) {
        position = super.setPosition(position);
        this.persistPosition(position);
        return position;
    }

    _onRender(context, options) {
        super._onRender(context, options);

        this.refreshSelected();

        let html = $(this.element);

        html.find('#alwayshp-btn-dead').click(ev => {
            ev.preventDefault();
            if (ev.shiftKey == true)
                this.changeHP(0, null, 'toggle');
            else {
                log('set character to dead');
                this.changeHP('zero', null, true);
                this.clearInput();
            }
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to hurt');
            this.changeHP('zero');
            this.clearInput();
        });
        html.find('#alwayshp-btn-hurt').click(ev => {
            ev.preventDefault();
            log('set character to hurt');
            let data = this.parseValue;
            if (data.value != '') {
                data.value = Math.abs(data.value);
                if (setting("wounds-system")) data.value = data.value * -1;
                this.changeHP(data.value, data.target);
            }
            this.clearInput();
        });
        html.find('#alwayshp-btn-heal').click(ev => {
            ev.preventDefault();
            log('set character to heal');
            let data = this.parseValue;
            if (data.value != '') {
                data.value = -Math.abs(data.value);
                if (setting("wounds-system")) data.value = data.value * -1;                
                this.changeHP(data.value, data.target, false);
            }
            this.clearInput();
        });
        html.find('#alwayshp-btn-fullheal').click(ev => {
            ev.preventDefault();
            log('set character to fullheal');
            this.changeHP('full', null, false);
            this.clearInput();
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to heal');
            this.changeHP('full');
            this.clearInput();
        });

        if (setting('double-click')) {
            html.find('#alwayshp-btn-hurt').dblclick(ev => {
                ev.preventDefault();
                log('set character to hurt');
                this.changeHP('zero');
                this.clearInput();
            });

            html.find('#alwayshp-btn-heal').dblclick(ev => {
                ev.preventDefault();
                log('set character to heal');
                this.changeHP('full');
                this.clearInput();
            });
        }
        html.find('#alwayshp-hp').focus(ev => {
            ev.preventDefault();
            let elem = ev.target;
            if (elem.setSelectionRange) {
                elem.focus();
                elem.setSelectionRange(0, $(elem).val().length);
            } else if (elem.createTextRange) {
                var range = elem.createTextRange();
                range.collapse(true);
                range.moveEnd('character', $(elem).val().length);
                range.moveStart('character', 0);
                range.select();
            }
        }).keypress(ev => {
            if (ev.which == 13) {
                let data = this.parseValue;
                if (data.value != '' && data.value != 0) {
                    ev.preventDefault();

                    let rawvalue = $('#alwayshp-hp', this.element).val();

                    if (setting("wounds-system"))
                        data.value = (rawvalue.startsWith('+') || (!rawvalue.startsWith('-') && !setting("no-sign-negative")) ? Math.abs(data.value) : -Math.abs(data.value));    
                    else
                        data.value = (rawvalue.startsWith('+') || (!rawvalue.startsWith('-') && !setting("no-sign-negative")) ? -Math.abs(data.value) : Math.abs(data.value));
                    this.changeHP(data.value, data.target); //Heal with a + but everything else is a hurt
                    this.clearInput();
                }
            }
        });

        html.find('.death-savingthrow').click(ev => {
            ev.preventDefault();
            log('add death saving throw');
            this.addDeathST($(ev.currentTarget).hasClass('save'), 1);
        }).contextmenu(ev => {
            ev.preventDefault();
            log('remove death saving throw');
            this.addDeathST($(ev.currentTarget).hasClass('save'), -1);
        });

        
        html.find('.resource').mousemove(ev => {
            if (!setting("allow-bar-click"))
                return;
            let perc = ev.offsetX / $(ev.currentTarget).width();
            if (setting("wounds-system"))  perc = 1 - perc;            
            let change = this.getChangeValue(perc);

            if (setting("wounds-system"))  change = change * -1;      
            $('.bar-change', html).html(change);
            log("resource change");
        }).click(ev => {
            if (!setting("allow-bar-click"))
                return;
            let perc = ev.offsetX / $(ev.currentTarget).width();
            if (setting("wounds-system"))  perc = 1 - perc;
            let change = this.getChangeValue(perc);

            this.changeHP(-change, 'regular');
            $('.bar-change', html).html('');
        });

        html.find('.bar-change').mousemove(ev => {
            ev.preventDefault;
            ev.stopPropagation();
            log("bar change");
        });
    }

    async close(options) {
        if (options?.properClose) {
            super.close(options);
            game.AlwaysHP.app = null;
        }
    }

    getData() {
        return {
            tokenname: this.tokenname
        };
    }

    getResourceValue(actor, resourceName) {
        if (resourceName == "" || resourceName.startsWith("."))
            return 0;
        return parseInt(foundry.utils.getProperty(actor, `system.${resourceName}`) ?? 0);
    }

    async changeHP(value = 0, target = null, addStatus = null) {
        if (setting("wounds-system")) {
            switch(value.value) {
                case 'zero':
                    value.value = 'full';
                    break;
                case 'full':
                    value.value = 'zero';
                    break;
                }
        }

        let actors = canvas.tokens.controlled.flatMap((t) => {
            if (t.actor?.type == "group") {
                return Array.from(t.actor?.system.members);
            } else
                return t.actor;
        });
        for (let a of actors) {
            if (!a || !(a instanceof Actor))
                continue;

            let tValue = foundry.utils.duplicate(value);

            let resourceValue = this.getResourceValue(a, setting("resourcename"));

            // If setting to zero or full, calculate the actual value
            if (value == 'zero') {
                let tempValue = this.getResourceValue(a, setting("tempresource"));
                tValue = resourceValue + tempValue;
            }
            else if (value == 'full') {
                let maxValue = this.getResourceValue(a, setting("maxresource"));
                tValue = resourceValue - maxValue;
            }

            let defeatedStatus = CONFIG.specialStatusEffects.DEFEATED;

            // Apply defeated status if applicable
            if (addStatus != null && setting("add-defeated")) {
                let status = CONFIG.statusEffects.find(e => e.id === defeatedStatus);
                let effect = game.system.id == "pf2e" ? status : a && status ? status : CONFIG.controlIcons.defeated;

                const exists = a.statuses.has(effect.id);

                if (exists != addStatus)
                    await a.toggleStatusEffect(effect.id ?? effect, { active: (addStatus == 'toggle' ? !exists : addStatus) });
            }

            // Clear death saves if applicable
            if (addStatus === false && setting("clear-savingthrows")) {
                a.update({
                    "system.attributes.death.failure": 0,
                    "system.attributes.death.success": 0
                });
            }

            log('applying damage', a, tValue, target);
            // Apply the damage/heal if not zero
            if (tValue.value != 0) {
                await this.applyDamage(a, tValue, target);
            }
        };

        this.refreshSelected();
    }

    async applyDamage(actor, value, target) {
        // PF2e-specific handling to avoid data preparation errors with synthetic actors
        if (game.system.id === "pf2e") {
            try {
                return await this.applyDamagePF2e(actor, value, target);
            } catch (e) {
                error("PF2e damage application failed", e);
                // Fall through to generic handler
            }
        }

        // Generic/fallback damage application
        return await this.applyDamageGeneric(actor, value, target);
    }

    /**
     * PF2e-specific damage application that properly handles synthetic actors
     * Uses the base actor for updates when dealing with unlinked tokens
     */
    async applyDamagePF2e(actor, value, target) {
        let updates = {};
        
        // Get current values
        const hp = actor.system.attributes?.hp;
        if (!hp) {
            warn("Actor has no HP attribute, falling back to generic handler");
            return await this.applyDamageGeneric(actor, value, target);
        }

        const currentValue = hp.value ?? 0;
        const currentTemp = hp.temp ?? 0;
        const maxValue = hp.max ?? 0;
        
        if (target === "max") {
            // Modifying max HP
            const newMax = maxValue - value;
            updates["system.attributes.hp.max"] = newMax;
        } else if (target === "temp") {
            // Modifying temp HP only
            const newTemp = Math.max(0, currentTemp - value);
            updates["system.attributes.hp.temp"] = newTemp;
        } else {
            // Standard damage/healing
            let tempDamage = 0;
            let hpDamage = value;
            
            // For damage (positive value), apply to temp HP first
            if (value > 0 && target !== 'regular' && currentTemp > 0) {
                tempDamage = Math.min(currentTemp, value);
                hpDamage = value - tempDamage;
                updates["system.attributes.hp.temp"] = currentTemp - tempDamage;
            }
            
            // Apply remaining to regular HP
            if (target !== 'temp' && hpDamage !== 0) {
                const minHP = setting("allow-negative") ? -2000 : 0;
                const newHP = Math.clamp(currentValue - hpDamage, minHP, maxValue);
                updates["system.attributes.hp.value"] = newHP;
            }
        }

        // Check if this is a synthetic (unlinked token) actor
        const isSynthetic = actor.isToken && !actor.prototypeToken?.actorLink;
        
        if (isSynthetic && actor.token) {
            // For synthetic actors, update through the token's actor delta
            // This avoids triggering full actor re-preparation that can fail
            try {
                return await actor.token.update({
                    "delta.system.attributes.hp": foundry.utils.mergeObject(
                        foundry.utils.duplicate(hp),
                        this.extractHPUpdates(updates)
                    )
                });
            } catch (deltaError) {
                warn("Token delta update failed, trying direct actor update", deltaError);
            }
        }
        
        // Standard update for linked actors or if delta update failed
        return await actor.update(updates);
    }

    /**
     * Extract HP-specific updates from the full updates object
     */
    extractHPUpdates(updates) {
        const hpUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (key.startsWith("system.attributes.hp.")) {
                const hpKey = key.replace("system.attributes.hp.", "");
                hpUpdates[hpKey] = value;
            }
        }
        return hpUpdates;
    }

    /**
     * Generic damage application for non-PF2e systems
     */
    async applyDamageGeneric(actor, value, target) {
        let updates = {};
        let resourceValue = this.getResourceValue(actor, setting("resourcename"));
        let tempValue = this.getResourceValue(actor, setting("tempresource"));
        let maxValue = this.getResourceValue(actor, setting("maxresource"));
        let tempMaxValue = this.getResourceValue(actor, setting("tempmaxresource"));

        // Deduct damage from temp HP first
        if (tempMaxValue && target == "max") {
            const dm = tempMaxValue - value;
            updates[`system.${setting("tempmaxresource")}`] = dm;
        } else {
            let dt = 0;
            let tmpMax = 0;
            if (tempValue || target == 'temp') {
                dt = (value > 0 || target == 'temp') && target != 'regular' && target != 'max' ? Math.min(tempValue, value) : 0;
                // Remaining goes to health

                tmpMax = tempMaxValue

                updates[`system.${setting("tempresource")}`] = tempValue - dt;
            }

            // Update the Actor
            if (target != 'temp' && target != 'max' && dt >= 0) {
                let change = (value - dt);
                const dh = Math.clamp(resourceValue - change, (setting("allow-negative") ? -2000 : 0), maxValue + tmpMax);
                updates[`system.${setting("resourcename") }`] = dh;
            }
        }

        return await actor.update(updates);
    }

    refreshSelected() {
        this.valuePct = null;
        this.tokenstat = "";
        this.tokentemp = "";
        this.tokentooltip = "";
        $('.character-name', this.element).removeClass("single");
        if (canvas.tokens?.controlled.length == 0)
            this.tokenname = "";
        else if (canvas.tokens?.controlled.length == 1) {
            let a = canvas.tokens.controlled[0].actor;
            if (!a)
                this.tokenname = "";
            else {
                $('.character-name', this.element).addClass("single");
                let resourceValue = this.getResourceValue(a, setting("resourcename"));

                let maxValue = this.getResourceValue(a, setting("maxresource"));
                if (setting("wounds-system")) resourceValue = maxValue - resourceValue;
                let tempValue = this.getResourceValue(a, setting("tempresource"));
                let tempMaxValue = this.getResourceValue(a, setting("tempmaxresource"));

                // Differentiate between effective maximum and displayed maximum
                const effectiveMax = Math.max(0, maxValue + tempMaxValue);
                let displayMax = maxValue + (tempMaxValue > 0 ? tempMaxValue : 0);

                // Allocate percentages of the total
                const tempPct = Math.clamp(tempValue, 0, displayMax) / displayMax;
                const valuePct = Math.clamp(resourceValue, 0, effectiveMax) / displayMax;

                this.valuePct = valuePct;
                this.tempPct = tempPct;
                const color = [(1 - (this.valuePct / 2)), this.valuePct, 0];
                this.color = `rgba(${parseInt(color[0] * 255)},${parseInt(color[1] * 255)},${parseInt(color[2] * 255)}, 0.7)`;

                this.tokenname = canvas.tokens.controlled[0]?.name ?? canvas.tokens.controlled[0]?.data?.name;
                this.tokenstat = resourceValue;
                this.tokentemp = tempValue;
                this.tokentooltip = `HP: ${resourceValue}, Temp: ${tempValue}, Max: ${maxValue}`;
            }
        }
        else {
            this.tokenname = `${i18n("ALWAYSHP.Multiple")} <span class="count">${canvas.tokens.controlled.length}</span>`;
        }

        this.changeToken();
    }

    addDeathST(save, value) {
        if (canvas.tokens.controlled.length == 1) {
            let a = canvas.tokens.controlled[0].actor;
            if (!a)
                return;

            let prop = a.system.attributes.death;
            prop[save ? 'success' : 'failure'] = Math.max(0, Math.min(3, prop[save ? 'success' : 'failure'] + value));

            let updates = {};
            updates["system.attributes.death." + (save ? 'success' : 'failure')] = prop[save ? 'success' : 'failure'];
            canvas.tokens.controlled[0].actor.update(updates);

            this.changeToken();
        }
    }

    changeToken() {
        if (!this.element)
            return;
        $('.character-name', this.element).html(this.tokenname);
        $('.token-stats', this.element).attr('title', this.tokentooltip).html((this.tokentemp ? `<div class="stat temp">${this.tokentemp}</div>` : '') + (this.tokenstat ? `<div class="stat" style="background-color:${this.color}">${this.tokenstat}</div>` : ''));

        let actor = (canvas.tokens.controlled.length == 1 ? canvas.tokens.controlled[0].actor : null);
        let data = actor?.system;
        let showST = (actor != undefined && game.system.id == "dnd5e" && data?.attributes?.hp?.value == 0 && actor?.hasPlayerOwner && setting("show-savingthrows"));
        $('.death-savingthrow', this.element).css({ display: (showST ? 'inline-block' : 'none') });
        if (showST && data.attributes.death) {
            $('.death-savingthrow.fail > div', this.element).each(function (idx) { $(this).toggleClass('active', idx < data.attributes.death.failure) });
            $('.death-savingthrow.save > div', this.element).each(function (idx) { $(this).toggleClass('active', idx < data.attributes.death.success) });
        }

        $('.resource', this.element).toggle(canvas.tokens.controlled.length == 1 && this.valuePct != undefined);
        if (this.valuePct != undefined) {
            $('.resource .bar', this.element).css({ width: (this.valuePct * 100) + '%', backgroundColor: this.color });
            $('.resource .temp-bar', this.element).toggle(this.tempPct > 0).css({ width: (this.tempPct * 100) + '%' });
        }
    }

    get parseValue() {
        let value = $('#alwayshp-hp', this.element).val();
        let result = { value: value };
        if (value.indexOf("r") > -1 || value.indexOf("R") > -1) {
            result.target = "regular";
            result.value = result.value.replace('r', '').replace('R', '');
        }
        if (value.indexOf("t") > -1 || value.indexOf("T") > -1) {
            result.target = "temp";
            result.value = result.value.replace('t', '').replace('T', '');
        }
        if (value.indexOf("m") > -1 || value.indexOf("M") > -1) {
            result.target = "max";
            result.value = result.value.replace('m', '').replace('M', '');
        }

        result.value = parseInt(result.value);
        if (isNaN(result.value))
            result.value = 1;
        return result;
    }

    clearInput() {
        if (setting("clear-after-enter"))
            $('#alwayshp-hp', this.element).val('');
    }

    getChangeValue(perc) {
        let change = "";
        if (canvas.tokens.controlled.length == 1 && canvas.tokens.controlled[0].actor?.type != "group") {
            const actor = canvas.tokens.controlled[0].actor;

            if (!actor)
                return;

            let resourceValue = this.getResourceValue(actor, setting("resourcename"));
            let maxValue = this.getResourceValue(actor, setting("maxresource"));

            if (maxValue) {
                let tempMaxValue = this.getResourceValue(actor, setting("tempmaxresource"));
                const effectiveMax = Math.max(0, maxValue + tempMaxValue);
                let val = Math.floor(parseInt(effectiveMax * perc));
                if (val >= 0)
                    val++;
                change = val - Math.floor(parseInt(resourceValue));
            }
        }

        return change;
    }

    onPersistPosition(position) {
        game.user.setFlag("always-hp", "alwayshpPos", { left: position.left, top: position.top });
    }

    static canLoad() {
        return (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' && game.user.isGM) || (setting("load-option") == 'players' && !game.user.isGM));
    }
}

Hooks.on('init', () => {
    registerSettings();

    game.keybindings.register('always-hp', 'toggle-key', {
        name: 'ALWAYSHP.toggle-key.name',
        hint: 'ALWAYSHP.toggle-key.hint',
        editable: [],
        onDown: () => {
            game.AlwaysHP.toggleApp();
        },
    });

    game.keybindings.register('always-hp', 'focus-key', {
        name: 'ALWAYSHP.focus-key.name',
        hint: 'ALWAYSHP.focus-key.hint',
        editable: [],
        onDown: () => {
            if (!game.AlwaysHP.app) {
                game.AlwaysHP.app = new AlwaysHP();
                game.AlwaysHP.app.render(true);
            } else
                game.AlwaysHP.app.bringToTop();
            $('#alwayshp-hp', game.AlwaysHP.app.element).focus();
        },
    });

    game.AlwaysHP = {
        app: null,
        toggleApp: (show = 'toggle') => {
            if (show == 'toggle') show = !game.AlwaysHP.app;

            if (show && !game.AlwaysHP.app) {
                game.AlwaysHP.app = new AlwaysHP();
                game.AlwaysHP.app.render(true);
            } else if (!show && game.AlwaysHP.app)
                game.AlwaysHP.app.close({ properClose: true });
        },
        refresh: () => {
            if (game.AlwaysHP.app)
                game.AlwaysHP.app.refreshSelected();
        }
    };

    if (!game.modules.get("monks-active-tiles")?.active) {
        patchFunc("foundry.helpers.interaction.ClientKeybindings.prototype._registerCoreKeybindings", function (wrapped, ...args) {
            let result = wrapped(...args);

            game.keybindings.actions.get("core.dismiss").onDown = async function (context) {
                // Cancel current drag workflow
                if (canvas.currentMouseManager) {
                    canvas.currentMouseManager.interactionData.cancelled = true;
                    canvas.currentMouseManager.cancel();
                    return true;
                }

                // Save fog of war if there are pending changes
                if (canvas.ready) canvas.fog.commit();

                // Case 1 - dismiss an open context menu
                if (ui.context?.element) {
                    await ui.context.close();
                    return true;
                }

                // Case 2 - dismiss an open Tour
                if (foundry.nue.Tour.tourInProgress) {
                    foundry.nue.Tour.activeTour.exit();
                    return true;
                }

                // Case 3 - close open UI windows
                const closingApps = [];
                for (const app of Object.values(ui.windows)) {
                    closingApps.push(app.close({ closeKey: true }).then(() => !app.rendered));
                }
                for (const app of foundry.applications.instances.values()) {
                    if (app.hasFrame && !app.nonDismissible) closingApps.push(app.close({ closeKey: true }).then(() => !app.rendered));
                }
                const closedApp = (await Promise.all(closingApps)).some(c => c); // Confirm an application actually closed
                if (closedApp) return true;

                // Case 4 (GM) - release controlled objects (if not in a preview)
                if (game.view !== "game") return;
                const layer = canvas.activeLayer;
                if (layer instanceof foundry.canvas.layers.InteractionLayer) {
                    if (layer._onDismissKey(context.event)) return true;
                }

                // Case 5 - toggle the main menu
                ui.menu.toggle();
                // Save the fog immediately rather than waiting for the 3s debounced save as part of commitFog.
                if (canvas.ready) await canvas.fog.save();
                return true;
            }

            return result
        });
    }
});

Hooks.on('ready', async () => {
    if (["dnd5e", "pf2e", "sw5e"].includes(game.system.id) && setting("resourcename") == "attributes.hp") {
        game.settings.set("always-hp", "resourcename", "attributes.hp.value");

        for (let i = 0; i < game.actors.contents.length; i++) {
            let actor = game.actors.contents[i];
            let hp = foundry.utils.getProperty(actor, "system.attributes.hp");
            if ((typeof hp !== "object" || hp === null) && hp !== undefined) {
                console.log(`always-hp | Fixing actor ${actor.name} HP data structure: ${hp}`);
                await actor.update({ "system.attributes.hp": { value: 1 } }, { allowHPOverage: 1 });
            }
        }
    }

    let r = document.querySelector(':root');
    r.style.setProperty('--ahp-heal-dark', setting("heal-dark"));
    r.style.setProperty('--ahp-heal-light', setting("heal-light"));
    r.style.setProperty('--ahp-hurt-dark', setting("hurt-dark"));
    r.style.setProperty('--ahp-hurt-light', setting("hurt-light"));

    if ((setting("show-option") == 'on' || (setting("show-option") == 'toggle' && setting("show-dialog"))) && AlwaysHP.canLoad())
        game.AlwaysHP.toggleApp(true);

    if (setting("show-option") == "combat" && AlwaysHP.canLoad() && game.combats.active && game.combats.active.started && !game.AlwaysHP)
        game.AlwaysHP.toggleApp(true);
});

Hooks.on('controlToken', () => {
    if (setting("show-option") == "token" && AlwaysHP.canLoad()) {
        if (canvas.tokens.controlled.length == 0) // delay a second to make sure we aren't selecting a new token
            window.setTimeout(() => { if (canvas.tokens.controlled.length == 0) game.AlwaysHP.toggleApp(false); }, 100);
        else if (!game.AlwaysHP.app)
            window.setTimeout(() => { game.AlwaysHP.toggleApp(true); }, 100);
        else
            game.AlwaysHP.refresh();
    } else
        game.AlwaysHP.refresh();
});

Hooks.on('updateActor', (actor, data) => {
    //log('Updating actor', actor, data);
    if (canvas.tokens.controlled.length == 1
        && canvas.tokens.controlled[0]?.actor?.id == actor.id
        && (foundry.utils.getProperty(data, "system.attributes.death") != undefined || foundry.utils.getProperty(data, `system.${setting("resourcename") }`))) {
        game.AlwaysHP.refresh();
    }
});

Hooks.on('updateCombat', (combat, data) => {
    if (setting("show-option") == "combat" && AlwaysHP.canLoad()) {
        game.AlwaysHP.toggleApp(game.combats.active && game.combats.active.started);
    }
});

Hooks.on('deleteCombat', (combat, data) => {
    if (setting("show-option") == "combat" && AlwaysHP.canLoad()) {
        game.AlwaysHP.toggleApp(game.combats.active && game.combats.active.started);
    }
});

Hooks.on("getSceneControlButtons", (controls) => {
    if (setting("show-option") == 'toggle' && AlwaysHP.canLoad()) {
        let tokenControls = controls.tokens;
        tokenControls.tools.toggledialog = {
            name: "toggledialog",
            title: "ALWAYSHP.toggledialog",
            icon: "fas fa-briefcase-medical",
            toggle: true,
            active: setting('show-dialog'),
            onClick: (toggled) => {
                game.settings.set('always-hp', 'show-dialog', toggled);
                game.AlwaysHP.toggleApp(toggled);
            }
        };
    }
});

Hooks.on("renderSettingsConfig", (app, html, user) => {
    $("input[name='always-hp.heal-dark']", html).replaceWith(`
    <color-picker name="always-hp.heal-light" value="${setting('heal-light') || '#15838d'}"></color-picker>
    <color-picker name="always-hp.heal-dark" value="${setting('heal-dark') || '#4dd0e1'}"></color-picker>
    `);
    $("input[name='always-hp.hurt-dark']", html).replaceWith(`
    <color-picker name="always-hp.hurt-light" value="${setting('hurt-light') || '#ff6400'}"></color-picker>
    <color-picker name="always-hp.hurt-dark" value="${setting('hurt-dark') || '#ff0000'}"></color-picker>
    `);
});

