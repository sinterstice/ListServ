const _ = require('lodash');
const nanoid = require('nanoid');
const { app, output } = require('@azure/functions');

const sendToCosmosDB = output.cosmosDB({
    databaseName: 'listserv',
    containerName: 'interviews',
    collectionName: 'Items',
    createIfNotExists: true,
    connection: 'CosmosDBConnection'
});

app.http('interview', {
    methods: ['POST'],
    authLevel: 'anonymous',
    extraOutputs: [sendToCosmosDB],
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        try {
            context.log(`New interview submission`);

            const bodyText = await request.text();
            context.log(`Request body: ${bodyText}`)

            const body = JSON.parse(bodyText)

            let { email, ...fields } = body;

            const isEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(email);

            if (email !== undefined && !isEmail) {
                return { status: 400, body: 'Email is invalid' };
            }

            for (const [id, value] of Object.entries(fields)) {
                if (typeof value !== 'string') {
                    return { status: 400, body: 'Invalid submission' };
                }
            }

            const id = nanoid();

            const document = { id, email, ...fields };

            context.extraOutputs.set(sendToCosmosDB, document);

            return { status: 200, body: `Interview submitted!` };
        } catch(error) {
            context.error(error.message);
            context.error(error.stack);
            return { status: 500, body: 'Internal Server Error' };
        }

    }
});
