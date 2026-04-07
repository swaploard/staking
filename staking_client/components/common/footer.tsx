export function Footer() {
  return (
    <footer className="border-t border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 mt-16">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Solana Staking</h3>
            <p className="text-sm text-slate-400">
              Maximize your SOL rewards through strategic staking across verified pools.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="/" className="hover:text-white transition-colors">Dashboard</a></li>
              <li><a href="/pools" className="hover:text-white transition-colors">Explore Pools</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-700 pt-8 text-center text-sm text-slate-400">
          <p>
            This is a demonstration dashboard. Always do your own research before staking real assets.
          </p>
          <p className="mt-4">© 2024 Solana Staking Dashboard. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
