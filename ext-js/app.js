/*
 * This file launches the application by asking Ext JS to create
 * and launch() the Application class.
 */
Ext.application({
    extend: 'FinApp.Application',

    name: 'FinApp',

    requires: [
        // This will automatically load all classes in the FinApp namespace
        // so that application classes do not need to require each other.
        'FinApp.*'
    ],

    // The name of the initial view to create.
    mainView: 'FinApp.view.main.Main'
});
