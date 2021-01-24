import { ColumnApi, GridApi } from "ag-grid-community";
import "ag-grid-community/dist/styles/ag-grid.css";
import "ag-grid-community/dist/styles/ag-theme-alpine.css";
import "ag-grid-enterprise";
import { AgGridColumn, AgGridReact } from "ag-grid-react";
import debounce from "lodash.debounce";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import * as React from "react";
import { useEffect, useState } from "react";
import { hot } from "react-hot-loader";
import ReactJson from "react-json-view";
import {
  cancelActiveOrder,
  getAllActiveOrders,
  getPositions,
  getWalletBalance,
  placeActiveOrder,
  subAccount,
  subTrade,
} from "./api";
import { IBalance } from "./balance";
import { IActiveOrder, IPosition, TradeSymbol } from "./ts";
import { toFloat, toInt } from "./util";
import { placeConditionalOrder } from "./api";

const MIN_PRICE_INCREMENT = 0.5;
const MIN_QTY_INCREMENT = 0.001;

function App() {
  const [api_key, setApiKey] = useState("");
  const [secret, setSecret] = useState("");

  const [symbol, setSymbol] = useState<TradeSymbol>("BTCUSDT");
  const [balance, setBalance] = useState<IBalance>(null);

  const [leverage, setLeverage] = useState(7);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [spreadCount, setSpreadCount] = useState(50);
  const [percent, setPercent] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(true);

  const [results, setResults] = useState([]);

  const [lastPrice, setLastPrice] = useState(0);

  const [orderGridApi, setOrderGridApi] = useState<GridApi>(null);
  const [orderGridColumnApi, setOrderGridColumnApi] = useState<ColumnApi>(null);

  const [positionGridApi, setPositionGridApi] = useState<GridApi>(null);
  const [positionGridColumnApi, setPositionGridColumnApi] = useState<ColumnApi>(
    null,
  );

  const [orders, setOrders] = useState<IActiveOrder[]>([]);
  const [positions, setPositions] = useState<IPosition[]>([]);

  useEffect(
    () =>
      subTrade(symbol, (e) => {
        const data = JSON.parse(e.data);
        if (data.topic === `trade.${symbol}`) {
          const last = data.data?.[data.data.length - 1];
          const price = toFloat(last?.price);
          if (price) {
            setLastPrice(price);
            setMinPrice((x) => x || price);
            setMaxPrice((x) => x || price);
          }
        }
      }),
    [symbol],
  );

  const loadOrders = React.useMemo(
    () =>
      debounce(
        () => {
          if (api_key && secret && symbol) {
            getAllActiveOrders({
              symbol,
              api_key,
              secret,
              limit: 50,
              order_status: ["New", "PartiallyFilled"].join(","),
            }).then(setOrders);
          }
        },
        500,
        { leading: false, trailing: true },
      ),
    [api_key, secret, symbol],
  );

  useEffect(loadOrders, [api_key, secret, symbol]);

  const loadPositions = React.useMemo(
    () =>
      debounce(
        () => {
          if (api_key && secret && symbol) {
            getPositions({
              api_key,
              secret,
              symbol,
            }).then((res: any) => {
              if (res.data.ret_code === 0) {
                setPositions(res.data.result || []);
              }
            });
          }
        },
        500,
        { leading: false, trailing: true },
      ),
    [api_key, secret, symbol],
  );

  useEffect(loadPositions, [api_key, secret, symbol]);

  useEffect(() => {
    const tid = setInterval(loadPositions, 60 * 1000);
    return () => clearInterval(tid);
  }, [loadPositions]);

  useEffect(() => {
    if (!api_key || !secret) return undefined;

    getWalletBalance({
      api_key,
      secret,
    }).then((res: any) => {
      setBalance(res.data.result.USDT);
    });
  }, [api_key, secret]);

  useEffect(() => {
    if (!api_key || !secret) return undefined;

    return subAccount({ api_key, secret }, (e) => {
      const data = JSON.parse(e.data);
      console.log("account", data);
      switch (data.topic) {
        case "order":
          loadOrders();
          break;
        case "position":
          loadPositions();
          break;
        case "wallet":
          setBalance((x) => ({ ...x, ...data.data[0] }));
          break;
      }
    });
  }, [api_key, secret]);

  const labelClass = "text-sm font-bold text-gray-700 dark:text-white";

  const inputClass =
    "bg-white dark:bg-gray-700 border dark:border-gray-500 rounded text-gray-700 dark:text-white leading-tight";

  const walletBalance = balance?.wallet_balance || 0;
  const availableBalance = balance?.available_balance || 0;
  const inUseBalance = walletBalance - availableBalance;

  const toOrderBalance = (walletBalance * percent) / 100;

  const isLong = maxPrice < lastPrice;

  const longPositionQty = positions.reduce(
    (s, p) => s + ((p.side === "Buy" && p.size) || 0),
    0,
  );
  const shortPositionQty = positions.reduce(
    (s, p) => s + ((p.side === "Sell" && p.size) || 0),
    0,
  );

  const longPositionToCloseQty = positions.reduce(
    (s, p) => s + ((p.side === "Buy" && p.free_qty) || 0),
    0,
  );
  const shortPositionToCloseQty = positions.reduce(
    (s, p) => s + ((p.side === "Sell" && p.free_qty) || 0),
    0,
  );

  const qtyToClose = isLong ? shortPositionToCloseQty : longPositionToCloseQty;

  const toOrderQty = (qtyToClose * percent) / 100;

  const disabled =
    !api_key ||
    !secret ||
    !minPrice ||
    !maxPrice ||
    minPrice > maxPrice ||
    !spreadCount ||
    !percent ||
    (reduceOnly
      ? !toOrderQty || !qtyToClose || toOrderQty > qtyToClose
      : !toOrderBalance ||
        !availableBalance ||
        toOrderBalance > availableBalance);

  interface IToOrder {
    price: number;
    qty: number;
    value: number;
    stop_loss: number;
    reduce_only: boolean;
  }

  const toOrders = React.useMemo<Array<IToOrder>>(() => {
    if (disabled) return [];

    const priceRange = maxPrice - minPrice;

    const priceStep = Math.max(
      MIN_PRICE_INCREMENT,
      spreadCount > 1
        ? Math.round(priceRange / (spreadCount - 1) / MIN_PRICE_INCREMENT) *
            MIN_PRICE_INCREMENT
        : 0,
    );

    const toSpend = reduceOnly ? toOrderQty : toOrderBalance * leverage;

    const stepSize = toSpend / spreadCount;

    const toOrderList: IToOrder[] = [];
    let total = 0;
    for (
      let stepPrice = minPrice;
      stepPrice <= maxPrice && total <= toSpend;
      stepPrice += priceStep
    ) {
      const exactQty = reduceOnly ? stepSize : stepSize / stepPrice;

      const roundedQty =
        Math.round(exactQty / MIN_QTY_INCREMENT) * MIN_QTY_INCREMENT;

      total += reduceOnly ? roundedQty : stepPrice * roundedQty;

      if (roundedQty && total <= toSpend) {
        toOrderList.push({
          price: stepPrice,
          qty: roundedQty,
          value: stepPrice * roundedQty,
          stop_loss: stopLoss,
          reduce_only: reduceOnly,
        });
      }
    }

    return toOrderList;
  }, [
    minPrice,
    maxPrice,
    spreadCount,
    percent,
    stopLoss,
    reduceOnly,
    toOrderBalance,
    toOrderQty,
    disabled,
  ]);

  const rowHeight = 30;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 text-black dark:text-white">
      <style>
        {`
        .buy.buy.buy {
          background: rgba(0,255,0,0.3);
        }
        .sell.sell.sell {
          background: rgba(255,0,0,0.3);
        }
        `}
      </style>
      <h1 className="mt-2 text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl mb-8">
        <a href="https://www.bybit.com/trade/usdt/BTCUSDT">ByBit</a>
      </h1>
      <div className="mb-3">
        <label htmlFor="api_key" className={`${labelClass} block mb-1`}>
          API Key
        </label>
        <input
          id="api_key"
          name="api_key"
          className={`${inputClass} w-48 p-2`}
          type="text"
          value={api_key}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>
      <div className="mb-5">
        <label htmlFor="secret" className={`${labelClass} block mb-1`}>
          API Secret
        </label>
        <input
          id="secret"
          name="secret"
          className={`${inputClass} w-48 p-2`}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </div>
      <label htmlFor="symbol" className={`${labelClass} block mb-1`}>
        Market
      </label>
      <select
        id="symbol"
        name="symbol"
        className={`${inputClass} w-32 p-2 font-semibold`}
        value={symbol}
        onChange={(e) => setSymbol(e.target.value as TradeSymbol)}
      >
        <option value="BTCUSDT">BTCUSDT</option>
        <option value="ETHUSDT">ETHUSDT</option>
        <option value="LTCUSDT">LTCUSDT</option>
        <option value="LINKUSDT">LINKUSDT</option>
        <option value="XTZUSDT">XTZUSDT</option>
        <option value="BCHUSDT">BCHUSDT</option>
      </select>
      <div className="block text-lg font-bold my-4">Price: ${lastPrice}</div>
      <div className="flex flex-row mb-5">
        <div>
          <span className={labelClass}>Wallet: </span>$
          {walletBalance.toFixed(2)}
        </div>
        <div className="ml-5">
          <span className={labelClass}>Available: </span>$
          {availableBalance.toFixed(2)}
        </div>
        <div className="ml-5">
          <span className={labelClass}>In Use: </span>${inUseBalance.toFixed(2)}
        </div>
      </div>
      <div className="flex flex-row mb-5">
        <div>
          <label htmlFor="minPrice" className={`${labelClass} block mb-1`}>
            Min Price
          </label>
          <input
            id="minPrice"
            className={`${inputClass} w-24 p-2 py-1`}
            type="number"
            step={0.5}
            name="minPrice"
            value={minPrice}
            onChange={(e) => {
              setMinPrice(toFloat(e.target.value) || 0);
            }}
          />
        </div>
        <div className="ml-8">
          <label htmlFor="maxPrice" className={`${labelClass} block mb-1`}>
            Max Price
          </label>
          <input
            id="maxPrice"
            className={`${inputClass} w-24 p-2 py-1`}
            type="number"
            step={0.5}
            name="maxPrice"
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(toFloat(e.target.value) || 0);
            }}
          />
        </div>
        <div className="ml-8">
          <label htmlFor="stopLoss" className={`${labelClass} block mb-1`}>
            Stop Loss
          </label>
          <input
            id="stopLoss"
            className={`${inputClass} w-24 p-2 py-1`}
            type="number"
            step={0.5}
            name="stopLoss"
            value={stopLoss}
            onChange={(e) => {
              setStopLoss(toFloat(e.target.value) || 0);
            }}
          />
        </div>
        <div className="ml-8">
          <label htmlFor="percent" className={`${labelClass} block mb-1`}>
            Percent
          </label>
          <input
            id="percent"
            className={`${inputClass} w-24 p-2 py-1`}
            type="number"
            step={1}
            name="percent"
            value={percent.toFixed(0)}
            onChange={(e) => {
              setPercent(toInt(e.target.value) || 0);
            }}
          />
        </div>
        <div className="ml-8">
          <label htmlFor="spreadCount" className={`${labelClass} block mb-1`}>
            Spread Count
          </label>
          <input
            id="spreadCount"
            className={`${inputClass} w-24 p-2 py-1`}
            type="number"
            step={1}
            name="spreadCount"
            value={spreadCount.toFixed(0)}
            onChange={(e) => {
              setSpreadCount(toInt(e.target.value) || 0);
            }}
          />
        </div>
        <div className="ml-8">
          <label htmlFor="leverage" className={`${labelClass} block mb-1`}>
            Leverage
          </label>
          <input
            id="leverage"
            className={`${inputClass} w-24 p-2 py-1`}
            type="number"
            step={1}
            name="leverage"
            value={leverage.toFixed(1)}
            onChange={(e) => {
              setLeverage(toFloat(e.target.value) || 0);
            }}
          />
        </div>
      </div>

      <Slider
        className="max-w-lg"
        value={percent}
        min={0}
        max={100}
        step={1}
        onChange={setPercent}
      />
      <div className="flex flex-row mb-5">
        <div>
          <span className={labelClass}>To Order: </span>
          {reduceOnly ? toOrderQty : `$${toOrderBalance.toFixed(2)}`}
        </div>
        <div className="ml-5">
          <span className={labelClass}>Can Use: </span>
          {reduceOnly ? qtyToClose : `$${availableBalance.toFixed(2)}`}
        </div>
      </div>
      <div className="flex flex-row mb-5">
        <div>
          <span className={labelClass}>Long To Close: </span>
          {longPositionToCloseQty}
        </div>
        <div className="ml-5">
          <span className={labelClass}>Short To Close: </span>
          {shortPositionToCloseQty}
        </div>
        <div className="ml-5">
          <span className={labelClass}>Long Holding: </span>
          {longPositionQty}
        </div>
        <div className="ml-5">
          <span className={labelClass}>Short Holding: </span>
          {shortPositionQty}
        </div>
      </div>

      <div className="flex flex-row mb-5">
        <div className="flex flex-row items-center">
          <label htmlFor="reduceOnly" className={`${labelClass} block`}>
            Reduce Only
          </label>
          <input
            id="reduceOnly"
            className={`${inputClass} p-2 ml-2`}
            type="checkbox"
            name="reduceOnly"
            checked={reduceOnly}
            onChange={(e) => {
              setReduceOnly(e.target.checked);
            }}
          />
        </div>
        <div className="flex flex-row items-center ml-5">
          <label htmlFor="postOnly" className={`${labelClass} block`}>
            Post Only
          </label>
          <input
            id="postOnly"
            className={`${inputClass} p-2 ml-2`}
            type="checkbox"
            name="postOnly"
            checked={postOnly}
            onChange={(e) => {
              setPostOnly(e.target.checked);
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 30, marginBottom: 30 }}>
        <button
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          type="button"
          name="Long"
          disabled={
            disabled ||
            maxPrice >= lastPrice ||
            minPrice >= lastPrice ||
            (stopLoss && minPrice <= stopLoss)
          }
          onClick={async () => {
            await Promise.all(
              toOrders.map((item) =>
                placeActiveOrder({
                  secret,
                  api_key,
                  symbol,
                  side: "Buy",
                  order_type: "Limit",
                  price: item.price,
                  qty: item.qty,
                  // stop_loss: item.stop_loss || undefined, // up to 20 stop loss is supported
                  time_in_force: postOnly ? "PostOnly" : "GoodTillCancel",
                  reduce_only: item.reduce_only,
                  close_on_trigger: false,
                }),
              ),
            );
            if (!reduceOnly && stopLoss) {
              await placeConditionalOrder({
                secret,
                api_key,
                symbol,
                side: "Sell",
                order_type: "Market",
                // price: stopLoss,
                base_price: minPrice,
                stop_px: stopLoss,
                qty:
                  Math.round(
                    toOrders.reduce((s, x) => s + x.qty, 0) / MIN_QTY_INCREMENT,
                  ) * MIN_QTY_INCREMENT,
                // stop_loss: item.stop_loss || undefined, // up to 20 stop loss is supported
                time_in_force: postOnly ? "PostOnly" : "GoodTillCancel",
                reduce_only: true,
                close_on_trigger: false,
              });
            }
          }}
        >
          Long
        </button>

        <button
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ml-3 disabled:opacity-50"
          type="button"
          name="Short"
          disabled={
            disabled ||
            maxPrice <= lastPrice ||
            minPrice <= lastPrice ||
            (stopLoss && maxPrice >= stopLoss)
          }
          onClick={async () => {
            await Promise.all(
              toOrders.map((item) =>
                placeActiveOrder({
                  secret,
                  api_key,
                  symbol,
                  side: "Sell",
                  order_type: "Limit",
                  price: item.price,
                  qty: item.qty,
                  // stop_loss: item.stop_loss || undefined, // up to 20 stop loss is supported
                  time_in_force: postOnly ? "PostOnly" : "GoodTillCancel",
                  reduce_only: item.reduce_only,
                  close_on_trigger: false,
                }),
              ),
            );
            if (!reduceOnly && stopLoss) {
              await placeConditionalOrder({
                secret,
                api_key,
                symbol,
                side: "Buy",
                order_type: "Market",
                // price: stopLoss,
                base_price: minPrice,
                stop_px: stopLoss,
                qty:
                  Math.round(
                    toOrders.reduce((s, x) => s + x.qty, 0) / MIN_QTY_INCREMENT,
                  ) * MIN_QTY_INCREMENT,
                // stop_loss: item.stop_loss || undefined, // up to 20 stop loss is supported
                time_in_force: postOnly ? "PostOnly" : "GoodTillCancel",
                reduce_only: true,
                close_on_trigger: false,
              });
            }
          }}
        >
          Short
        </button>
      </div>
      <div className="ag-theme-alpine">
        <h2 className={`${labelClass} text-xl mt-5 mb-1`}>To Order</h2>
        <div className="flex flex-row mb-2">
          <div>
            <span className={labelClass}>Count: {toOrders.length}</span>
          </div>
          <div className="ml-5">
            <span className={labelClass}>
              Qty: {toOrders.reduce((s, x) => s + x.qty, 0).toFixed(3)}
            </span>
          </div>
          <div className="ml-5">
            <span className={labelClass}>
              Value: ${toOrders.reduce((s, x) => s + x.value, 0).toFixed(1)}
            </span>
          </div>
        </div>
        <AgGridReact
          rowData={toOrders}
          rowSelection="multiple"
          domLayout="autoHeight"
          gridOptions={{
            headerHeight: 30,
            rowHeight,
            rowClassRules: {
              buy: 'data.side == "Buy"',
              sell: 'data.side == "Sell"',
            },
          }}
        >
          <AgGridColumn
            field="price"
            sortable
            filter
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="qty"
            sortable
            filter
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="value"
            sortable
            filter
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="stop_loss"
            sortable
            resizable
            width={120}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="reduce_only"
            sortable
            filter
            resizable
            width={120}
            suppressMenu
          ></AgGridColumn>
        </AgGridReact>

        <h2 className={`${labelClass} text-xl mt-5 mb-1`}>Positions</h2>
        <div className="mb-2 flex flex-row">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={loadPositions}
          >
            Refresh
          </button>
        </div>
        <AgGridReact
          onGridReady={(params) => {
            setPositionGridApi(params.api);
            setPositionGridColumnApi(params.columnApi);
          }}
          rowData={positions}
          rowSelection="multiple"
          domLayout="autoHeight"
          gridOptions={{
            headerHeight: 30,
            rowHeight,
            rowClassRules: {
              buy: 'data.side == "Buy"',
              sell: 'data.side == "Sell"',
            },
          }}
        >
          <AgGridColumn
            checkboxSelection
            resizable
            width={40}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="position_status"
            sortable
            filter
            resizable
            width={60}
          ></AgGridColumn>
          <AgGridColumn
            field="symbol"
            sortable
            filter
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="position_value"
            sortable
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="entry_price"
            sortable
            resizable
            initialSort="desc"
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="size"
            sortable
            resizable
            width={80}
          ></AgGridColumn>
          <AgGridColumn
            field="free_qty"
            sortable
            resizable
            width={80}
          ></AgGridColumn>
          <AgGridColumn
            field="liq_price"
            sortable
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="take_profit"
            sortable
            resizable
            width={80}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="stop_loss"
            sortable
            resizable
            width={80}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="trailing_stop"
            sortable
            resizable
            width={80}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="tp_sl_mode"
            sortable
            filter
            resizable
            width={100}
          ></AgGridColumn>
          <AgGridColumn
            field="side"
            sortable
            filter
            resizable
            width={100}
          ></AgGridColumn>
          <AgGridColumn
            field="unrealised_pnl"
            sortable
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="realised_pnl"
            sortable
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="position_margin"
            sortable
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="leverage"
            sortable
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="is_isolated"
            sortable
            filter
            resizable
            width={120}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="auto_add_margin"
            sortable
            filter
            resizable
            width={120}
            suppressMenu
          ></AgGridColumn>
        </AgGridReact>

        <h2 className={`${labelClass} text-xl mt-5 mb-1`}>Orders</h2>
        <div className="mb-2 flex flex-row">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={loadOrders}
          >
            Refresh
          </button>
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ml-2"
            onClick={async () => {
              const selected = orderGridApi?.getSelectedNodes() || [];
              if (
                api_key &&
                secret &&
                selected.length &&
                confirm("cancel selected?")
              ) {
                await Promise.all(
                  selected.map((x) =>
                    cancelActiveOrder({
                      api_key,
                      secret,
                      symbol: x.data.symbol,
                      order_id: x.data.order_id,
                    }),
                  ),
                );
              }
            }}
          >
            Cancel Selected
          </button>
        </div>
        <AgGridReact
          onGridReady={(params) => {
            setOrderGridApi(params.api);
            setOrderGridColumnApi(params.columnApi);
          }}
          rowData={orders}
          rowSelection="multiple"
          domLayout="autoHeight"
          gridOptions={{
            headerHeight: 30,
            rowHeight,
            rowClassRules: {
              buy: 'data.side == "Buy"',
              sell: 'data.side == "Sell"',
            },
          }}
        >
          <AgGridColumn
            checkboxSelection
            resizable
            width={40}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="symbol"
            sortable
            filter
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="price"
            sortable
            resizable
            initialSort="desc"
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="qty"
            sortable
            resizable
            width={80}
          ></AgGridColumn>
          <AgGridColumn
            field="side"
            sortable
            filter
            resizable
            width={100}
          ></AgGridColumn>
          <AgGridColumn
            field="order_type"
            sortable
            filter
            resizable
            width={120}
          ></AgGridColumn>
          <AgGridColumn
            field="close_on_trigger"
            sortable
            filter
            resizable
            width={120}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="reduce_only"
            sortable
            filter
            resizable
            width={120}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="take_profit"
            sortable
            resizable
            width={80}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="stop_loss"
            sortable
            resizable
            width={80}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="tp_trigger_by"
            sortable
            resizable
            width={120}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="sl_trigger_by"
            sortable
            resizable
            width={120}
            suppressMenu
          ></AgGridColumn>
          <AgGridColumn
            field="order_status"
            sortable
            filter
            resizable
            width={100}
          ></AgGridColumn>
        </AgGridReact>

        <ReactJson src={results} theme="monokai" collapsed />
      </div>
    </div>
  );
}

declare let module: Record<string, unknown>;

export default hot(module)(App);
