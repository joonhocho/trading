export type Side = "Buy" | "Sell";

export type Currency = "BTC" | "ETH" | "EOS" | "XRP" | "USDT";

export type TradeSymbol =
  | "BTCUSDT"
  | "ETHUSDT"
  | "LTCUSDT"
  | "LINKUSDT"
  | "XTZUSDT"
  | "BCHUSDT";

export type WalletFund =
  | "Deposit"
  | "Withdraw"
  | "RealisedPNL"
  | "Commission"
  | "Refund"
  | "Prize"
  | "ExchangeOrderWithdraw"
  | "ExchangeOrderDeposit";

export type WithdrawStatus =
  | "ToBeConfirmed"
  | "UnderReview"
  | "Pending"
  | "Success"
  | "CancelByUser"
  | "Reject"
  | "Expire";

export type OrderType = "Limit" | "Market";

export type TimeInForce =
  | "GoodTillCancel"
  | "ImmediateOrCancel"
  | "FillOrKill"
  | "PostOnly";

export type TriggerPrice = "LastPrice" | "IndexPrice" | "MarkPrice";

export type Sort = "desc" | "asc";

export type OrderStatus =
  | "Created"
  | "Rejected"
  | "New"
  | "PartiallyFilled"
  | "Filled"
  | "Cancelled"
  | "PendingCancel";

export type StopOrderStatus =
  | "Active"
  | "Untriggered"
  | "Triggered"
  | "Cancelled"
  | "Rejected"
  | "Deactivated";

export type Cancel =
  | "CancelByUser"
  | "CancelByReduceOnly"
  | "CancelByPrepareLiq"
  | "CancelByPrepareAdl"
  | "CancelByAdmin"
  | "CancelByTpSlTsClear"
  | "CancelByPzSideCh";

export type Create =
  | "CreateByUser"
  | "CreateByClosing"
  | "CreateByAdminClosing"
  | "CreateByStopOrder"
  | "CreateByTakeProfit"
  | "CreateByStopLoss"
  | "CreateByTrailingStop"
  | "CreateByLiq"
  | "CreateByAdl_PassThrough"
  | "CreateByTakeOver_PassThrough";

export type Exec = "Trade" | "AdlTrade" | "Funding" | "BustTrade";

export type Liquidity = "AddedLiquidity" | "RemovedLiquidity";

export type TickDirection =
  | "PlusTick"
  | "ZeroPlusTick"
  | "MinusTick"
  | "ZeroMinusTick";

export type TpSlMode = "Full" | "Partial";

export interface IActiveOrder {
  close_on_trigger: boolean;
  created_time: string;
  cum_exec_fee: number;
  cum_exec_qty: number;
  cum_exec_value: number;
  last_exec_price: number;
  order_id: string;
  order_link_id: string;
  order_status: string;
  order_type: string;
  price: number;
  qty: number;
  reduce_only: boolean;
  side: string;
  sl_trigger_by: string;
  stop_loss: number;
  symbol: string;
  take_profit: number;
  time_in_force: string;
  tp_trigger_by: string;
  updated_time: string;
  user_id: number;
}

export interface IPosition {
  adl_rank_indicator?: string;
  auto_add_margin: string;
  bust_price: number;
  cum_realised_pnl: number;
  deleverage_indicator: number;
  entry_price: number;
  free_qty: number;
  is_isolated: boolean;
  leverage: number;
  liq_price: number;
  occ_closing_fee: number;
  order_margin?: number;
  position_id?: string;
  position_margin: number;
  position_seq?: string;
  position_status?: string;
  position_value: number;
  realised_pnl: number;
  side: string;
  size: number;
  sl_trigger_by?: string;
  stop_loss?: number;
  symbol: string;
  take_profit?: number;
  tp_sl_mode: string;
  tp_trigger_by?: string;
  trailing_stop?: number;
  unrealised_pnl: number;
  user_id: number;
}
