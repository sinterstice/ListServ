const { app, output, input } = require('@azure/functions');

const readCosmosDB = input.cosmosDB({
    containerName: 'listserv',
    databaseName: 'listserv',
    collectionName: 'signups',
    id: '{Query.email}',
    createIfNotExists: true,
    connection: 'AzureWebJobsStorage'
})

const sendToCosmosDB = output.cosmosDB({
    containerName: 'listserv',
    databaseName: 'listserv',
    collectionName: 'signups',
    createIfNotExists: true,
    connection: 'AzureWebJobsStorage'
});

app.http('Signup', {
    methods: ['POST'],
    authLevel: 'anonymous',
    extraInputs: [readCosmosDB],
    extraOutputs: [sendToCosmosDB],
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        try {
            const email = request.query.get('email');

            const isEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(email + ''.trim().toLowerCase());

            if (!isEmail) {
                return { status: 400, body: 'Email is invalid' };
            }

            const body = await request.json();
            let { tags } = body;

            console.log(tags)

            if (!tags || !Array.isArray(tags) || tags.some((t) => typeof t !== 'string' || t.length < 1)) {
                return { status: 400, body: 'Tags are invalid' };
            }

            const existing = context.extraInputs.get(readCosmosDB);

            if (existing) {
                tags = [ ...existing.tags, tags ];
            }

            context.extraOutputs.set(sendToCosmosDB, { id: email, Email: email, tags });

            return { body: `Hello, ${email}!` };
        } catch(err) {
            console.error(err);
            return { status: 500, body: 'Internal Server Error' };
        }

    }
});
