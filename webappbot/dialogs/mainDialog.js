// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer,durationDialog) {
        super('MainDialog');

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;

        if (!durationDialog) throw new Error('[MainDialog]: Missing parameter \'durationDialog\' is required');

        // Define the main dialog and its related components.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(durationDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a dialogue request like, "how many hours does it take to complete this course".
     * Note that there's no logic to catch additional dialogues not in intents. The LUIS app returns
     * the requested module type based on the entity found.
     */
    async introStep(stepContext) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }

        const messageText = stepContext.options.restartMsg ? stepContext.options.restartMsg : 'Hi! I\'m the course assistant bot for Grade 9. What can I help you with?\nYou can say things like, "estimated duraton to complete course contents", "How many units are in the course", "What\s the learning objective of this course?"';
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }

    /**
     * Second step in the waterfall.  This will use LUIS to attempt to extract the pizza type.
     * Then, it hands off to the durationDialog child dialog to confirm the order.
     */
    async actStep(stepContext) {
        const orderDetails = {};

        if (!this.luisRecognizer.isConfigured) {
            // LUIS is not configured, we just run the durationDialog path.
            return await stepContext.beginDialog('durationDialog', orderDetails);
        }

        // Call LUIS and gather any potential order details. (Note the TurnContext has the response to the prompt)
        const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        switch (LuisRecognizer.topIntent(luisResult)) {
            
        case 'ask duration': {
            const getMenuText = 'To achieve all of the learning outcomes in the Grade 9 Mathematics course , I suggest a total of 110 hours.';
            await stepContext.context.sendActivity(getMenuText, getMenuText, InputHints.IgnoringInput);
            break;
        }
            
        case 'ask units': {
            const moduleEntities = this.luisRecognizer.getModuleEntities(luisResult);

            orderDetails.type = moduleEntities;
            console.log('LUIS extracted these booking details:', JSON.stringify(orderDetails));

            return await stepContext.beginDialog('durationDialog', orderDetails);
        }

        case 'orderStatus': {
            const getOrderStatusText = 'Your pizza will be ready soon!';
            await stepContext.context.sendActivity(getOrderStatusText, getOrderStatusText, InputHints.IgnoringInput);
            break;
        }
        
        case 'greetings': {
            const getGreetingsText = 'Hi there!';
            await stepContext.context.sendActivity(getGreetingsText, getGreetingsText, InputHints.IgnoringInput);
            break;
        }

        default: {
            // Catch all for unhandled intents
            const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${ LuisRecognizer.topIntent(luisResult) })`;
            await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
        }
        }

        return await stepContext.next();
    }

    /**
     * This is the final step in the main waterfall dialog.
     * It wraps up the sample "order a pizza" interaction with a simple confirmation.
     */
    async finalStep(stepContext) {
        // If the order dialog ("durationDialog") was cancelled or the user failed to confirm, the Result here will be null.
        if (stepContext.result) {
            const result = stepContext.result;
            const msg = `I believe I have answered your question.`;
            await stepContext.context.sendActivity(msg, msg, InputHints.IgnoringInput);
        }

        // Restart the main dialog with a different message the second time around
        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: 'What else can I do for you?' });
    }
}

module.exports.MainDialog = MainDialog;
