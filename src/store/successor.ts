/**
 * The suite's next release (board D121): a build made with
 * `VITE_ACCEPTANCE_SUCCESSOR=1` has database and schema versions one higher,
 * with an empty migration, so the acceptance suite can serve two real
 * releases at one origin and prove one upgrades from the other (B-21). Every
 * other build, the app's included: 0.
 */
export const SUCCESSOR: 0 | 1 = import.meta.env.VITE_ACCEPTANCE_SUCCESSOR === '1' ? 1 : 0;
