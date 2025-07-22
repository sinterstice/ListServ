const _ = require('lodash');
const { app, output, input } = require('@azure/functions');

const readCosmosDB = input.cosmosDB({
    containerName: 'listserv',
    databaseName: 'listserv',
    collectionName: 'Items',
    id: '{Query.email}',
    connection: 'AzureWebJobsStorage'
})

const sendToCosmosDB = output.cosmosDB({
    containerName: 'listserv',
    databaseName: 'listserv',
    collectionName: 'Items',
    createIfNotExists: true,
    connection: 'AzureWebJobsStorage',
});

app.http('Unsubscribe', {
    methods: ['POST'],
    authLevel: 'anonymous',
    extraInputs: [readCosmosDB],
    extraOutputs: [sendToCosmosDB],
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        try {
            const email = request.query.get('email');

            context.log(`Unsubscribe request for email: ${email}`);

            const isEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(email + ''.trim().toLowerCase());

            if (!isEmail) {
                context.log('Invalid email');
                return { status: 400, body: 'Email is invalid' };
            }

            const existing = context.extraInputs.get(readCosmosDB);
            
            if (!existing) {
                context.log(`Subscriber not found`);
                return { status: 400, body: 'Subscriber not found' };
            }

            const bodyText = await request.text();
            context.log(`Request body: ${bodyText}`);

            let body, tags;
            
            if (bodyText) {
                body = JSON.parse(bodyText);
                ({ tags } = body);
            }

            if (!tags) {
                context.log('No tags provided, unsubscribing from all.');

                const document = {
                    ...existing,
                    tags: []
                }

                context.extraOutputs.set(sendToCosmosDB, document);
            } else if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string' || t.length < 1)) {
                context.log('Invalid tags');
                return { status: 400, body: 'Tags are invalid' };
            } else {
                context.log(`Unsubscribing user from lists: ${tags.join(', ')}`);
    
                const document = {
                    ...existing,
                    tags: _.without(existing.tags, tags)
                }

                context.extraOutputs.set(sendToCosmosDB, document);
            }

            return { body: `You are unsubscribed!` };
        } catch(error) {
            context.log(error);
            return { status: 500, body: 'Internal Server Error' };
        }

    }
});
