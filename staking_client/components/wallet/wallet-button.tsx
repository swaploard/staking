"use client";

import dynamic from "next/dynamic";

/**
 * Dynamically import wallet button.
 *
 * SSR is disabled because Solana wallet adapters
 * are browser-only components.
 */
const WalletMultiButtonDynamic = dynamic(
    async () => {
        const mod = await import(
            "@solana/wallet-adapter-react-ui"
        );

        return mod.WalletMultiButton;
    },
    {
        ssr: false,

        /**
         * Optional loading state.
         */
        loading: () => (
            <button className="wallet-adapter-button wallet-adapter-button-trigger">
                Loading Wallet...
            </button>
        ),
    }
);

export default function WalletButton(props: any) {
    return <WalletMultiButtonDynamic {...props} />;
}
