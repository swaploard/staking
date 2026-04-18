export function Footer() {
  return (
    <footer
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-default)',
        marginTop: '48px',
      }}
    >
      <div
        style={{
          maxWidth: '72rem',
          margin: '0 auto',
          padding: '32px 24px',
        }}
      >
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h4
              style={{
                fontSize: '15px',
                fontWeight: 560,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Solana Staking
            </h4>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              Maximize your SOL rewards through strategic staking across verified pools.
            </p>
          </div>

          <div>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 560,
                color: 'var(--text-primary)',
                marginBottom: '12px',
              }}
            >
              Quick Links
            </h4>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <a
                  href="/"
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-tertiary)',
                    transition: 'color 0.15s',
                    textDecoration: 'none',
                  }}
                  className="hover:!text-[var(--text-primary)]"
                >
                  Dashboard
                </a>
              </li>
              <li>
                <a
                  href="/pools"
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-tertiary)',
                    transition: 'color 0.15s',
                    textDecoration: 'none',
                  }}
                  className="hover:!text-[var(--text-primary)]"
                >
                  Explore Pools
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 560,
                color: 'var(--text-primary)',
                marginBottom: '12px',
              }}
            >
              Resources
            </h4>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <a
                  href="#"
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-tertiary)',
                    transition: 'color 0.15s',
                    textDecoration: 'none',
                  }}
                  className="hover:!text-[var(--text-primary)]"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="#"
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-tertiary)',
                    transition: 'color 0.15s',
                    textDecoration: 'none',
                  }}
                  className="hover:!text-[var(--text-primary)]"
                >
                  Community
                </a>
              </li>
              <li>
                <a
                  href="#"
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-tertiary)',
                    transition: 'color 0.15s',
                    textDecoration: 'none',
                  }}
                  className="hover:!text-[var(--text-primary)]"
                >
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div
          style={{
            marginTop: '24px',
            borderTop: '1px solid var(--border-default)',
            paddingTop: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            This is a demonstration dashboard. Always do your own research before staking real assets.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
            © 2024 Solana Staking Dashboard. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
