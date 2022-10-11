import * as web3 from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID as METAPLEX_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';

export const getMetadataForMint = async (mint: web3.PublicKey): Promise<[web3.PublicKey, number]> => {
    return await web3.PublicKey.findProgramAddress(
        [Buffer.from('metadata'), METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        METAPLEX_PROGRAM_ID
    );
};

export const getAtaForMint = async (mint: web3.PublicKey, buyer: web3.PublicKey): Promise<[web3.PublicKey, number]> => {
    return await web3.PublicKey.findProgramAddress(
        [buyer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
};

export const getUseAuthorityRecordForMint = async (
    mint: web3.PublicKey,
    authority: web3.PublicKey
): Promise<[web3.PublicKey, number]> => {
    return await web3.PublicKey.findProgramAddress(
        [
            Buffer.from('metadata'),
            TOKEN_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
            Buffer.from('user'),
            authority.toBuffer(),
        ],
        METAPLEX_PROGRAM_ID
    );
};
