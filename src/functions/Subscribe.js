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
    connection: 'AzureWebJobsStorage'
});

app.http('subscribe', {
    methods: ['POST'],
    authLevel: 'anonymous',
    extraInputs: [readCosmosDB],
    extraOutputs: [sendToCosmosDB],
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        try {
            const email = request.query.get('email');

            context.log(`Signup request for email: ${email}`);

            const isEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(email + ''.trim().toLowerCase());

            if (!isEmail) {
                return { status: 400, body: 'Email is invalid' };
            }

            const bodyText = await request.text();
            context.log(`Request body: ${bodyText}`)

            const body = JSON.parse(bodyText)

            let { tags } = body;

            if (!tags || !Array.isArray(tags) || tags.some((t) => typeof t !== 'string' || t.length < 1)) {
                return { status: 400, body: 'Tags are invalid' };
            }

            const existing = context.extraInputs.get(readCosmosDB);
            
            if (existing) {
                context.log(`Found existing record with tags ${existing.tags}. Merging...`);
            } else {
                context.log('Existing record not found. Adding new subscriber...')
            }

            const document = {
                id: email,
                email: email,
                tags: [ ...existing?.tags || [], ...tags ]
            };

            context.extraOutputs.set(sendToCosmosDB, document);

            return { body: `You have now subscribed!` };
        } catch(error) {
            context.log(error);
            return { status: 500, body: 'Internal Server Error' };
        }

    }
});
