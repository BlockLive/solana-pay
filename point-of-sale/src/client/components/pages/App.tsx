import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { GlowWalletAdapter, PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Keypair, PublicKey } from '@solana/web3.js';
import { AppContext, AppProps as NextAppProps, default as NextApp } from 'next/app';
import { AppInitialProps } from 'next/dist/shared/lib/utils';
import { FC, useMemo } from 'react';
import { DEVNET_ENDPOINT } from '../../utils/constants';
import { ConfigProvider } from '../contexts/ConfigProvider';
import { FullscreenProvider } from '../contexts/FullscreenProvider';
import { PaymentProvider } from '../contexts/PaymentProvider';
import { ThemeProvider } from '../contexts/ThemeProvider';
import { TransactionsProvider } from '../contexts/TransactionsProvider';
import { SolanaPayLogo } from '../images/SolanaPayLogo';
import { SOLIcon } from '../images/SOLIcon';
import css from './App.module.css';


import { MAINNET_ENDPOINT, MAINNET_USDC_MINT } from '../../utils/constants';
import { USDCIcon } from '../images/USDCIcon';


import Pusher from 'pusher-js'

const pusher = new Pusher('1b902f5ba54cd567012f', {
    cluster: 'us2',
  })
  
const channel = pusher.subscribe('channel-name')

// Bind a callback function to an event within the subscribed channel
// @ts-ignore
channel.bind('event-name', function (data) {
    // Do what you wish with the data from the event
    console.log("PUSHER!:", data)
});

interface AppProps extends NextAppProps {
    host: string;
    query: {
        recipient?: string;
        label?: string;
        message?: string;
    };
}

const App: FC<AppProps> & { getInitialProps(appContext: AppContext): Promise<AppInitialProps> } = ({
    Component,
    host,
    query,
    pageProps,
}) => {
    const baseURL = `https://${host}`;
    const channel = Keypair.generate().publicKey.toBase58();

    // If you're testing without a mobile wallet, set this to true to allow a browser wallet to be used.
    const connectWallet = false;
    // If you're testing without a mobile wallet, set this to Devnet or Mainnet to configure some browser wallets.
    const network = WalletAdapterNetwork.Devnet;
    // const network = WalletAdapterNetwork.Mainnet;

    const wallets = useMemo(
        () => (connectWallet ? [
            new GlowWalletAdapter({ network }),
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network })
        ] : []),
        [connectWallet, network]
    );

    // Toggle comments on these lines to use transaction requests instead of transfer requests.
    // const link = undefined;
    const link = useMemo(() => new URL(`${baseURL}/api/`), [baseURL]);

    let recipient: PublicKey | undefined = undefined;
    const { recipient: recipientParam, label, message } = query;
    if (recipientParam && label) {
        try {
            recipient = new PublicKey(recipientParam);
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <ThemeProvider>
            <FullscreenProvider>
                {recipient && label ? (
                    <ConnectionProvider endpoint={DEVNET_ENDPOINT}>
                        <WalletProvider wallets={wallets} autoConnect={connectWallet}>
                            <WalletModalProvider>
                            <ConfigProvider
                                baseURL={baseURL}
                                channel={channel}
                                link={link}
                                recipient={recipient}
                                label={label}
                                message={message}
                                symbol="SOL"
                                icon={<SOLIcon />}
                                decimals={9}
                                minDecimals={1}
                                connectWallet={connectWallet}
                                // baseURL={baseURL}
                                // link={link}
                                // recipient={recipient}
                                // label={label}
                                // message={message}
                                // splToken={MAINNET_USDC_MINT}
                                // symbol="USDC"
                                // icon={<USDCIcon />}
                                // decimals={6}
                                // minDecimals={2}
                                // connectWallet={connectWallet}
                            >
                                    <TransactionsProvider>
                                        <PaymentProvider>
                                            <Component {...pageProps} />
                                        </PaymentProvider>
                                    </TransactionsProvider>
                                </ConfigProvider>
                            </WalletModalProvider>
                        </WalletProvider>
                    </ConnectionProvider>
                ) : (
                    <div className={css.logo}>
                        <SolanaPayLogo width={240} height={88} />
                    </div>
                )}
            </FullscreenProvider>
        </ThemeProvider>
    );
};

App.getInitialProps = async (appContext) => {
    const props = await NextApp.getInitialProps(appContext);

    const { query, req } = appContext.ctx;
    const recipient = query.recipient as string;
    const label = query.label as string;
    const message = query.message || undefined;
    const host = req?.headers.host || 'localhost:3001';

    return {
        ...props,
        query: { recipient, label, message },
        host,
    };
};

export default App;
