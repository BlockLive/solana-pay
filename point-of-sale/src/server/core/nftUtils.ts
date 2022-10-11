import { Metaplex } from '@metaplex-foundation/js';
import * as web3 from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
interface collectionMintIDsAndTokenAddressPair {
    collectionMint: string;
    nftMint: web3.PublicKey;
}

async function findNftByOwner(metaplex: Metaplex, connection: web3.Connection, wallet: web3.PublicKey) {
    // todo(gtihtina): check if metaplex has get accounts
    const accounts = (
        await connection.getParsedTokenAccountsByOwner(wallet, {
            programId: new web3.PublicKey(TOKEN_PROGRAM_ID),
        })
    ).value.filter((account) => {
        const amount = account.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
        const decimals = account.account?.data?.parsed?.info?.tokenAmount?.decimals;
        // only grab NFTs
        return decimals === 0 && amount === 1;
    });

    return await Promise.all(
        accounts.map(async (account) => {
            try {
                const mintAddress = new web3.PublicKey(account.account?.data?.parsed?.info?.mint);
                return await metaplex.nfts().findByMint({ mintAddress }).run();
            } catch (err) {
                console.log(err);
                // do nothing since we might have NFTs without metadata
                // todo(gtihtina): find out why findAllByMintList isnt working.
                // my guess is it doesnt like the nfts with no metadata
                return;
            }
        })
    );
}

export async function getNftMintFromCollection(
    collection: string,
    connection: web3.Connection,
    wallet: web3.PublicKey
) {
    const metaplex = new Metaplex(connection);

    const nfts = (await findNftByOwner(metaplex, connection, wallet))?.filter(
        (nft) => nft !== undefined && (nft?.collection?.address?.toString() as string) == collection
    );
    return (
        nfts?.reduce((result, nft) => {
            const collectionMintId = nft?.collection?.address?.toString() as string;
            const pair: collectionMintIDsAndTokenAddressPair = {
                collectionMint: collectionMintId,
                nftMint: nft?.address as web3.PublicKey,
            };
            result.push(pair);
            return result;
        }, [] as collectionMintIDsAndTokenAddressPair[]) ?? []
    );
}

export async function nftExistsInWallet(
    collection: string,
    connection: web3.Connection,
    wallet: web3.PublicKey
): Promise<boolean> {
    let nfts = await getNftMintFromCollection(collection, connection, wallet);
    return nfts.length > 0;
}
