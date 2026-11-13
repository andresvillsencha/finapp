/**
 * The main application class. An instance of this class is created by app.js when it
 * calls Ext.application(). This is the ideal place to handle application launch and
 * initialization details.
 *
 * FinApp is the Ext JS Modern front end of PortfolioIQ, a DEMONSTRATION application:
 * every price, trade and return shown is simulated by the Node.js API.
 */
Ext.define('FinApp.Application', {
    extend: 'Ext.app.Application',

    name: 'FinApp',

    // Opens #dashboard when the page is loaded without a hash.
    defaultToken: 'dashboard',

    quickTips: false,
    platformConfig: {
        desktop: {
            quickTips: true
        }
    },

    onAppUpdate: function () {
        Ext.Msg.confirm('Application Update', 'This application has an update, reload?',
            function (choice) {
                if (choice === 'yes') {
                    window.location.reload();
                }
            }
        );
    }
});
