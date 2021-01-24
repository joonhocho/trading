/* eslint-disable @typescript-eslint/ban-types */
import axios, { AxiosResponse } from "axios";
import { hmacSha256 } from "./crypto";
import { TriggerPrice } from "./ts";
import {
  Currency,
  IActiveOrder,
  IPosition,
  OrderStatus,
  OrderType,
  Side,
  Sort,
  TimeInForce,
  TradeSymbol,
} from "./ts";

export interface IAuthParams {
  api_key: string;
  secret: string;
}

export interface IGetActiveOrderParams extends IAuthParams {
  order_id?: string;
  order_link_id?: string;
  symbol: TradeSymbol;
  order?: Sort;
  page?: number;
  limit?: number;
  order_status?: OrderStatus | string;
}

const ENDPOINT = `${location.origin}/api/bybit`;

export const getActiveOrder = <T>(
  params: IGetActiveOrderParams,
): Promise<AxiosResponse<T>> => {
  const url = new URL(`${ENDPOINT}/private/linear/order/list`);
  Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
  return axios.get(url.href);
};

export const getAllActiveOrders = async (
  params: IGetActiveOrderParams,
): Promise<IActiveOrder[]> => {
  const url = new URL(`${ENDPOINT}/private/linear/order/list`);
  Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));

  const { limit = 20 } = params;
  const orders: IActiveOrder[] = [];

  while (true) {
    const { data: { ret_code, result } = {} } = await axios.get(url.href);
    if (ret_code) {
      return null;
    }
    if (result) {
      const { current_page, data } = result;
      orders.push(...data);

      if (data.length < limit) break;
      url.searchParams.set("page", current_page + 1);
    }
  }

  return orders;
};

export interface IGetPositionParams extends IAuthParams {
  symbol: TradeSymbol;
}

export const getPositions = async (
  params: IGetPositionParams,
): Promise<IPosition[]> => {
  const url = new URL(`${ENDPOINT}/private/linear/position/list`);
  Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
  return axios.get(url.href);
};

export interface ICancelActiveOrderParams extends IAuthParams {
  symbol: TradeSymbol;
  order_id?: string;
  order_link_id?: string;
}

export const cancelActiveOrder = <T>(
  params: ICancelActiveOrderParams,
): Promise<AxiosResponse<T>> =>
  axios.post(`${ENDPOINT}/private/linear/order/cancel`, params);

export interface IGetWalletBalanceParams extends IAuthParams {
  coin?: Currency;
}

export const getWalletBalance = <T>(
  params: IGetWalletBalanceParams,
): Promise<AxiosResponse<T>> => {
  const url = new URL(`${ENDPOINT}/v2/private/wallet/balance`);
  Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
  return axios.get(url.href);
};

export interface IPlaceActiveOrderParams extends IAuthParams {
  side: Side;
  symbol: TradeSymbol;
  order_type: OrderType;
  qty: number;
  price?: number;
  time_in_force: TimeInForce;
  take_profit?: number;
  stop_loss?: number;
  tp_trigger_by?: string;
  sl_trigger_by?: string;
  reduce_only: boolean;
  close_on_trigger: boolean;
  order_link_id?: string;
}

export const placeActiveOrder = <T>(
  params: IPlaceActiveOrderParams,
): Promise<AxiosResponse<T>> =>
  axios.post(`${ENDPOINT}/private/linear/order/create`, params);

export interface IPlaceConditionalOrderParams extends IAuthParams {
  side: Side;
  symbol: TradeSymbol;
  order_type: OrderType;
  qty: number;
  price?: number;
  base_price: number;
  stop_px: number;
  time_in_force: TimeInForce;
  trigger_by?: TriggerPrice;
  close_on_trigger: boolean;
  order_link_id?: string;
  reduce_only: boolean;
  take_profit?: number;
  stop_loss?: number;
  tp_trigger_by?: string;
  sl_trigger_by?: string;
}

export const placeConditionalOrder = <T>(
  params: IPlaceConditionalOrderParams,
): Promise<AxiosResponse<T>> =>
  axios.post(`${ENDPOINT}/private/linear/stop-order/create`, params);

const WS_PUBLIC = "wss://stream.bybit.com/realtime_public";

const WS_PRIVATE = "wss://stream.bybit.com/realtime_private";

export const subTrade = (
  symbol: TradeSymbol,
  fn: (e: MessageEvent<any>) => void,
  ws = new WebSocket(WS_PUBLIC),
): (() => void) => {
  const open = () => {
    ws.send(`{"op":"subscribe","args":["trade.${symbol}"]}`);
    ws.addEventListener("message", fn);
  };
  ws.addEventListener("open", open);

  return () => {
    ws.removeEventListener("open", open);
    ws.removeEventListener("message", fn);
  };
};

export const subAccount = (
  { api_key, secret }: IAuthParams,
  fn: (e: MessageEvent<any>) => void,
): (() => void) => {
  let ws: WebSocket;

  const open = () => {
    ws.send(
      JSON.stringify({
        op: "subscribe",
        args: ["position", "order", "stop_order", "wallet"],
      }),
    );
    ws.addEventListener("message", fn);
  };

  // Signature
  const expires = Date.now() + 5000;

  hmacSha256(`GET/realtime${expires}`, secret).then((signature) => {
    // Establishing connection
    ws = new WebSocket(
      `${WS_PRIVATE}?api_key=${api_key}&expires=${expires}&signature=${signature}`,
    );
    ws.addEventListener("open", open);
  });

  return () => {
    if (ws) {
      ws.removeEventListener("open", open);
      ws.removeEventListener("message", fn);
      ws.close();
    }
  };
};
