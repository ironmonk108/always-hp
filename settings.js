import { i18n, setting } from "./alwayshp.js";
import {setting as mpSetting} from "./alwaysmp.js";

export const registerSettings = function () {
    let modulename = "always-hp";

    let showoptions = {
        'on': game.i18n.localize("ALWAYSHP.alwaysshow"),
        'off': game.i18n.localize("ALWAYSHP.dontshow"),
        'toggle': game.i18n.localize("ALWAYSHP.allowtoggle"),
        'token': game.i18n.localize("ALWAYSHP.token"),
        'combat': game.i18n.localize("ALWAYSHP.combat"),
    };

    let loadoptions = {
        'everyone': game.i18n.localize("ALWAYSHP.everyone"),
        'gm': game.i18n.localize("ALWAYSHP.gm"),
        'players': game.i18n.localize("ALWAYSHP.players"),
    };

    game.settings.register(modulename, "load-option", {
        name: game.i18n.localize("ALWAYSHP.load-option.name"),
        scope: "world",
        config: true,
        default: "everyone",
        type: String,
        choices: loadoptions,
        requiresReload: true
    });

    game.settings.register(modulename, "show-option", {
        name: game.i18n.localize("ALWAYSHP.show-option.name"),
        hint: game.i18n.localize("ALWAYSHP.show-option.hint"),
        scope: "client",
        config: true,
        default: "toggle",
        type: String,
        choices: showoptions,
        onChange: (value) => {
            let show = true;
            if (value == "off") show = false;
            else if (value == "toggled") show = setting("show-dialog")
            else if (value == "token") show = canvas.tokens.controlled.length;
            else if (value == "combat") show = game.combats.active && game.combats.active.started;
            game.AlwaysHP.toggleApp(show);
        }
    });

    game.settings.register(modulename, "load-option-mp", {
        name: game.i18n.localize("ALWAYSHP.load-option-mp.name"),
        scope: "world",
        config: false,
        default: "everyone",
        type: String,
        choices: loadoptions,
        requiresReload: true
    });

    game.settings.register(modulename, "show-option-mp", {
        name: game.i18n.localize("ALWAYSHP.show-option-mp.name"),
        hint: game.i18n.localize("ALWAYSHP.show-option-mp.hint"),
        scope: "client",
        config: true,
        default: "toggle",
        type: String,
        choices: showoptions,
        onChange: (value) => {
            let show = true;
            if (value == "off") show = false;
            else if (value == "toggled") show = mpSetting("show-dialog-mp")
            else if (value == "token") show = canvas.tokens.controlled.length;
            else if (value == "combat") show = game.combats.active && game.combats.active.started;
            game.AlwaysMP.toggleApp(show);
        }
    });


    game.settings.register(modulename, "resourcename", {
        name: i18n("ALWAYSHP.resourcename.name"),
        hint: i18n("ALWAYSHP.resourcename.hint"),
        scope: "world",
        default: (game.system.primaryTokenAttribute ?? game.system.data?.primaryTokenAttribute)  || 'attributes.hp',
        type: String,
        config: true
    });
    
    game.settings.register(modulename, "secondResourcename", {
        name: i18n("ALWAYSHP.secondResourcename.name"),
        hint: i18n("ALWAYSHP.secondResourcename.hint"),
        scope: "world",
        default: (game.system.secondaryTokenAttribute ?? game.system.data?.secondaryTokenAttribute)  || 'attributes.mp',
        type: String,
        config: true
    });


    game.settings.register(modulename, "no-sign-negative", {
        name: i18n("ALWAYSHP.no-sign-negative.name"),
        hint: i18n("ALWAYSHP.no-sign-negative.hint"),
        scope: "client",
        default: true,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "wounds-system", {
        name: i18n("ALWAYSHP.wounds-system.name"),
        hint: i18n("ALWAYSHP.wounds-system.hint"),
        scope: "world",
        default: false,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "add-defeated", {
        name: i18n("ALWAYSHP.add-defeated.name"),
        hint: i18n("ALWAYSHP.add-defeated.hint"),
        scope: "world",
        default: true,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "clear-savingthrows", {
        name: i18n("ALWAYSHP.clear-savingthrows.name"),
        hint: i18n("ALWAYSHP.clear-savingthrows.hint"),
        scope: "world",
        default: true,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "show-savingthrows", {
        name: i18n("ALWAYSHP.show-savingthrows.name"),
        hint: i18n("ALWAYSHP.show-savingthrows.hint"),
        scope: "world",
        default: true,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "clear-after-enter", {
        name: i18n("ALWAYSHP.clear-after-enter.name"),
        hint: i18n("ALWAYSHP.clear-after-enter.hint"),
        scope: "client",
        default: true,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "double-click", {
        name: i18n("ALWAYSHP.double-click.name"),
        hint: i18n("ALWAYSHP.double-click.hint"),
        scope: "client",
        default: false,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "allow-bar-click", {
        name: i18n("ALWAYSHP.allow-bar-click.name"),
        hint: i18n("ALWAYSHP.allow-bar-click.hint"),
        scope: "client",
        default: false,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "heal-dark", {
        name: i18n("ALWAYSHP.heal-color.name"),
        hint: i18n("ALWAYSHP.heal-color.hint"),
        scope: "client",
        default: "",
        type: String,
        config: true,
        onChange: (value) => {
            let r = document.querySelector(':root');
            r.style.setProperty('--ahp-heal-dark', value || '#4dd0e1');
        },
    });

    game.settings.register(modulename, "heal-light", {
        scope: "client",
        default: "",
        type: String,
        config: false,
        onChange: (value) => {
            let r = document.querySelector(':root');
            r.style.setProperty('--ahp-heal-light', value || '#15838d');
        },
    });

    game.settings.register(modulename, "hurt-dark", {
        name: i18n("ALWAYSHP.hurt-color.name"),
        hint: i18n("ALWAYSHP.hurt-color.hint"),
        scope: "client",
        default: "",
        type: String,
        config: true,
        onChange: (value) => {
            let r = document.querySelector(':root');
            r.style.setProperty('--ahp-hurt-dark', value || '#ff0000');
        },
    });

    game.settings.register(modulename, "hurt-light", {
        scope: "client",
        default: "",
        type: String,
        config: false,
        onChange: (value) => {
            let r = document.querySelector(':root');
            r.style.setProperty('--ahp-hurt-light', value || '#ff6400');
        },
    });

    /*
    game.settings.register(modulename, "gm-only", {
        name: i18n("ALWAYSHP.gm-only.name"),
        hint: i18n("ALWAYSHP.gm-only.hint"),
        scope: "world",
        default: false,
        type: Boolean,
        config: true
    });
    */

    //if (game.user.isGM || !game.settings.get("always-hp", "gm-only")){
        game.settings.register(modulename, "show-dialog", {
            name: i18n("ALWAYSHP.show-dialog.name"),
            hint: i18n("ALWAYSHP.show-dialog.hint"),
            scope: "client",
            default: true,
            type: Boolean,
            config: false
        });

        game.settings.register(modulename, "show-dialog-mp", {
            name: i18n("ALWAYSHP.show-dialog-mp.name"),
            hint: i18n("ALWAYSHP.show-dialog-mp.hint"),
            scope: "client",
            default: true,
            type: Boolean,
            config: false
        });
    //}
}