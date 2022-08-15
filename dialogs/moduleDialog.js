// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
const { ConfirmPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const CONFIRM_PROMPT = 'confirmPrompt';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

class OrderDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id || 'moduleDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.moduleStep.bind(this),
                this.confirmStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * If a module type has not been provided, prompt for one.
     */
    async moduleStep(stepContext) {
        const moduleDetails = stepContext.options;

        if (!moduleDetails.type.moduleType) {
            const messageText = 'For what module are you inquiring about?';
            const msg = MessageFactory.text(messageText, 'For what module are you inquiring about?', InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(moduleDetails.type.moduleType);
    }
    
    /**
     * Confirm the information the user has provided.
     */
     async confirmStep(stepContext) {
        const moduleDetails = stepContext.options;

        // Capture the results of the previous step
        moduleDetails.type = stepContext.result;
        const messageText = `Please confirm your query is for the ${ moduleDetails.type } module. Is this correct?`;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);

        // Offer a YES/NO prompt.
        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: msg });
    }
    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        if (stepContext.result === true) {
            const moduleDetails = stepContext.options;
            return await stepContext.endDialog(moduleDetails);
        }
        return await stepContext.endDialog();
    }

}

module.exports.ModuleDialog = ModuleDialog;