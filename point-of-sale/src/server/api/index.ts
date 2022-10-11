// Initial for Transfer
import { createTransfer } from '@solana/pay';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { NextApiHandler } from 'next';
import { connection } from '../core';
import { cors, rateLimit } from '../middleware';
import { nftExistsInWallet, getNftMintFromCollection } from '../core/nftUtils';
import { createUtilizeInstruction } from '@metaplex-foundation/mpl-token-metadata';

// Add for Transaction
import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddress, getMint } from '@solana/spl-token';
import { getAtaForMint, getMetadataForMint } from '../core/addressUtils';

// Add for Channels
const Channels = require('pusher');

const { APP_ID: appId, KEY: key, SECRET: secret, CLUSTER: cluster, CENTRAL_PAYER } = process.env;

const channels = new Channels({
    appId,
    key,
    secret,
    cluster,
});

interface GetResponse {
    label: string;
    icon: string;
}

const get: NextApiHandler<GetResponse> = async (request, response) => {
    const label = request.query.label;
    console.log('GET response for label: ', label);
    if (!label) throw new Error('missing label');
    if (typeof label !== 'string') throw new Error('invalid label');

    const icon = `https://${request.headers.host}/solana-pay-logo.svg`;

    response.status(200).send({
        label,
        icon,
    });
};

interface PostResponse {
    transaction?: string;
    message?: string;
    error?: string;
}
interface ChannelArgs {
    hasNft?: boolean;
    utilizeReady?: boolean;
}

async function createUtilizeIx(ticketCollectionMintIdField: string, sender: PublicKey, connection: Connection) {
    let { nftMint } = (await getNftMintFromCollection(ticketCollectionMintIdField, connection, sender))[0];
    const metadata = (await getMetadataForMint(nftMint))[0];
    const tokenAccount = (await getAtaForMint(nftMint, sender))[0];
    console.log(nftMint.toBase58());
    return createUtilizeInstruction(
        {
            metadata,
            tokenAccount,
            useAuthority: sender, // sender signing on sol pay scan
            mint: nftMint,
            owner: sender,
            useAuthorityRecord: undefined,
            burner: undefined,
        },
        {
            utilizeArgs: {
                numberOfUses: 1,
            },
        }
    );
}

const updateChannel = (channel: string, args: ChannelArgs) => {
    const eventName = 'entry-scan';
    const { hasNft, utilizeReady } = args;
    console.log("from update",  )
    channels.trigger(channel, eventName, {
        hasNft,
        utilizeReady,
    });
};

/*
    Transfer request.
    */
const post: NextApiHandler<PostResponse> = async (request, response) => {
    try {
        // // Account provVided in the transaction request body by the wallet.
        const accountField = request.body?.account;
        if (!accountField) throw new Error('missing account');

        const sender = new PublicKey(accountField);

        // Check for NFT, push status response onto channel.
        const channelField = String(request.query.channel);
        const ticketCollectionMintIdField = String(request.query.ticketCollectionMintId);
        let hasNft = false;
        try {
            hasNft = await nftExistsInWallet(ticketCollectionMintIdField, connection, sender);
        } catch (err) {
            console.log(err);
        } finally {
            updateChannel(channelField, { hasNft });
        }
        let utilizeReady = false;
        try {
            // create the transaction
            const transaction = new Transaction();
            // create utilize instruction
            const utilizeIx = await createUtilizeIx(ticketCollectionMintIdField, sender, connection);
            // add the instruction to the transaction
            transaction.add(utilizeIx);
            transaction.feePayer = sender;
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            // Serialize and return the unsigned transaction.
            const serializedTransaction = transaction.serialize({
                verifySignatures: false,
                requireAllSignatures: false,
            });

            const base64Transaction = serializedTransaction.toString('base64');
            const message = 'Thank you for your purchase of ExiledApe #518';

            utilizeReady = true;
            response.status(200).send({ transaction: base64Transaction, message });
        } catch (err) {
            console.log(err);
        } finally {
            updateChannel(channelField, { hasNft, utilizeReady });
        }
    } catch (err) {
        console.log('ERR TOP: ', err);
        // How to respond with error message to Phantom?
        response.status(500).send({ error: 'failed to load data' });
    }
};
const post_transfer: NextApiHandler<PostResponse> = async (request, response) => {
    /*
    Transfer request params provided in the URL by the app client. In practice, these should be generated on the server,
    persisted along with an unpredictable opaque ID representing the payment, and the ID be passed to the app client,
    which will include the ID in the transaction request URL. This prevents tampering with the transaction request.
    */
    const recipientField = request.query.recipient;
    if (!recipientField) throw new Error('missing recipient');
    if (typeof recipientField !== 'string') throw new Error('invalid recipient');
    const recipient = new PublicKey(recipientField);

    const amountField = request.query.amount;
    if (!amountField) throw new Error('missing amount');
    if (typeof amountField !== 'string') throw new Error('invalid amount');
    const amount = new BigNumber(amountField);

    const splTokenField = request.query['spl-token'];
    if (splTokenField && typeof splTokenField !== 'string') throw new Error('invalid spl-token');
    const splToken = splTokenField ? new PublicKey(splTokenField) : undefined;

    const referenceField = request.query.reference;
    if (!referenceField) throw new Error('missing reference');
    if (typeof referenceField !== 'string') throw new Error('invalid reference');
    const reference = new PublicKey(referenceField);

    const memoParam = request.query.memo;
    if (memoParam && typeof memoParam !== 'string') throw new Error('invalid memo');
    const memo = memoParam || undefined;

    const messageParam = request.query.message;
    if (messageParam && typeof messageParam !== 'string') throw new Error('invalid message');
    const message = messageParam || undefined;

    // Account provided in the transaction request body by the wallet.
    const accountField = request.body?.account;
    if (!accountField) throw new Error('missing account');
    if (typeof accountField !== 'string') throw new Error('invalid account');
    const account = new PublicKey(accountField);

    // Compose a simple transfer transaction to return. In practice, this can be any transaction, and may be signed.
    let transaction = await createTransfer(connection, account, {
        recipient,
        amount,
        splToken,
        reference,
        memo,
    });

    // Serialize and deserialize the transaction. This ensures consistent ordering of the account keys for signing.
    transaction = Transaction.from(
        transaction.serialize({
            verifySignatures: false,
            requireAllSignatures: false,
        })
    );

    // Serialize and return the unsigned transaction.
    const serialized = transaction.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
    });
    const base64 = serialized.toString('base64');

    response.status(200).send({ transaction: base64, message });
};

const index: NextApiHandler<GetResponse | PostResponse> = async (request, response) => {
    await cors(request, response);
    await rateLimit(request, response);

    if (request.method === 'GET') return get(request, response);
    if (request.method === 'POST') return post(request, response);

    throw new Error(`Unexpected method ${request.method}`);
};

export default index;
