# Version 13.01

Adding v13 Compatibility

# Version 12.01

Adding v12 Compatibility

Fixed issue with multiple names being added when AlwaysHP re-renders

Removed scrolling text on hp change because systems cover it

Added a keybinding to focus on the AlwaysHP text field

Added the option to change the colouring of the buttons.  In case the system has different colours, or for people with colour blindness.

Upgraded to handle system that use wounding rather than hp.  Thank you, sasquach45932, for the patch.

French translations added, thank you JDedeWS

# Version 11.05

Fixed issue when trying to collect controlled tokens when canvas is turned off

Cleared issue with changes made to Combat Details

# Version 11.04

Fixing issues with v11 statuses.

Adding hotkey to toggle the Always HP window.

# Version 11.01

Fixed issues with the D&D5e group actor.

Added option to hide the saving throw display.

# Version 10.5

Fixed issues with input field auto focussing.

# Version 10.4

Added Polish translation, thank you Lioheart

Focus on the input whenever AlwaysHP is rendered.

Fixed issue when selecting multiple tokens to set HP to 0 or to full, using the first tokens min/max value rather than the individual token's value.

Fixed issue with setting defeated status in PF2E.

Fixed issue with showing death saving throw if death saving throw isn't an attribute.

Added the option to show AlwaysHP whenever a token is being controlled, or only during combat.

Added an API for AlwaysHP so other modules can access the application, or toggle the window, or refresh the token.

Fixed issue with selecting a value off the HP bar, when a value is already in the text box.

Fixed issue with display in DSA

# Version 10.3

Fixing a bug, detecting if it's v10 or not.

# Version 10.2

Fixing a bug with the defeated status that was preventing a token from healing.

Added the option to change what AlwaysHP does with an unsigned value.  Currently a number without a + or minus is treate as negative and will hurt the token.  You can now change it so it will assume healing instead.

# Version 10.1

Fixed issues detecting when a token is defeated

Fixed an issue when a controlled token doesn't have an actor.

# Version 1.0.38

Fixing issues with changing the hp via the mouse over the bar.

Adding some styling changes

# Version 1.0.34

Adding support for v10

# Version 1.0.33

Fixed issue getting resource value when the system doesn't support the value

Added the option to adjust temporary max hp by using the 'm' attribute.  So `+m10` will add 10 max HP.

Added scrolling HP numbers when the value changes.

Added the option to make the HP bar reactive.  So hovering over the bar will show you what the value would change to if you clicked, and clicking the bar will change the value to that point.

# Version 1.0.31

Fixed issue where you weren't able to set the temp hp if the temp hp hadn't been set yet.

Changed background colour of stat to match the HP colour.

# Version 1.0.30

Added the HP bar for individually selected tokens, that also includes temporary hitpoints and changes colour to reflect the colours Foundry uses.

Changed how the HP and Temp HP is displayed.

Changed how the number of multiple tokens selected is shown.

Fixed an issue where selecting the token to go to zero wasn't taking temporary hitpoints into account

Added the options to change temporary hitpoints, or change regular hitpoints without disturbing temporary ones.  Using `+t5` you can add 5 temporary hitpoints, and using `-r10` you can subtract 10 regular hitpoints without affecting the temporary ones.

# Version 1.0.29

Fixed an issue where hitting the escape key was closing the window

Fixed an issue where incredibly long token names were hiding the HP

Added the option to show, hide and toggle the window.

# Version 1.0.27

Making sure the module works in v9.

Changed how the entire application is loaded.  Instead of strange class/application hybrid I merged them together as one App.  That uses the core settings to drag the window around.
I'm hoping this will make it a little more stable and easier to use.

Also added a toggle button to hide/show the window so that's a little more accessible and can be turned on or off as the player sees fit.  That way it can be removed outside of combat and then added back in when combat starts. 

# Version 1.0.26

Fixing issues with changes to using primaryTokenAttribute

# Version 1.0.25

changed to using game.system.data.primaryTokenAttribute instead of attribute.hp

Allow DnD3.5 and PF1 to set HP less than 0

# Version 1.0.24
Removing all the logging commands

# Version 1.0.23
Fixed an issue with hp being used as the resource name instead of using the resource that's in the settings.

# Version 1.0.21
Added Japanese translations (Thank you touge)

# Version 1.0.20
Fixed issues with mass update of tokens.  Due to the nature of some of the changes I'm making I have to wrap a lot of the token updates in an await.  So it leaves an animation of each token updating individually, rather than all at once.  It's annoying but functional.  I'll investigate a solution.

Merged a change (Than you DavidAremaCarretero) to fix a copy and paste error left behind from the 1.0.19 update.

# Version 1.0.19
Added Actor update hook to update the always HP bar when any actor changes are made.

Added setting to clear the text box after making a change.  So if you want to keep the last value, you can.

# Version 1.0.18
Added Death saving throws for DnD5e
Allow other systems than just DnD5e and PF2e by allowing GM's to set the resource that gets changed.

# Version 1.0.17
Added shift-click to the skull to toggle dead status.
Added the ability for the GM to turn off the players dialog.
Changed it so that any healing will remove the dead status.

# Version 1.0.16
Added setting so that players can turn off the dialog if they don't wish to see it.
Added right-click functions to the skull and heart, to change HP without changing the dead status.
Changed workflow so that skull will add the dead status and heart will clear it.

# Version 1.0.14
Added option to not set the defeated status when clicking the skull.

# Version 1.0.10
Fixed a bug, that if you press the up or down arrows and the text box is blank it would remove all HP.

# Version 1.0.9
Added functionality to use the enter key on the text box.  Using a +number will heal, everything else will hurt.  So if you want to remove HP, you don't need to add a - out front.  Just the number will do.

# Version 1.0.8
Added support for Pathfinder v2.  I'd assumed that a specific function of an actor was available across systems.  It was not.  Added my own function that replicated the bavior and adjusted the project settings so that only DnD5e and PFv2 were available.  Technically any system that uses HP could use the application now, but I'm not sure all the systems that use HP.  If you use one that uses the HP attribute, please contact me and I'll add it to the list.

# Version 1.0.7
Fixed a bug that prevented the window from showing if the window had never been moved before.
