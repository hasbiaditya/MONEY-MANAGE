import { Account, Transaction } from '../types/finance';

export function calculateAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Record<string, number> {
  const balances: Record<string, number> = {};
  accounts.forEach((acc) => {
    balances[acc.id] = acc.initialBalance;
  });

  transactions.forEach((tx) => {
    if (tx.type === 'income') {
      if (balances[tx.accountId] !== undefined) {
        balances[tx.accountId] += tx.amount;
      }
    } else if (tx.type === 'expense') {
      if (balances[tx.accountId] !== undefined) {
        balances[tx.accountId] -= tx.amount;
      }
    } else if (tx.type === 'transfer') {
      const fee = Math.max(0, tx.adminFee || 0);
      if (balances[tx.accountId] !== undefined) {
        balances[tx.accountId] -= tx.amount + fee;
      }
      if (tx.toAccountId && balances[tx.toAccountId] !== undefined) {
        balances[tx.toAccountId] += tx.amount;
      }
    }
  });

  return balances;
}

export function getTransactionExpenseImpact(tx: Transaction): number {
  if (tx.type === 'expense') return tx.amount;
  if (tx.type === 'transfer') return Math.max(0, tx.adminFee || 0);
  return 0;
}
