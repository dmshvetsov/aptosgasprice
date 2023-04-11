import React, { useRef, useEffect, useState } from 'react'
import { AptosClient } from 'aptos'
import { getRpcUrl, isEnv } from './config'
import { useQuery, QueryClient, QueryClientProvider } from 'react-query'
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts'

const queryClient = new QueryClient()

type AptosGasPrice = {
  fast: number
  standard: number
  slow: number
  time: number
}

type UseAptosEstimatedGasPriceOptions = {
  refetchInterval?: number
}

/**
 * In an non-congested network, the gas estimate will always be the lowest value.
 * There was some issues with the way the gas was being estimated,
 * so it’s been changed to send the lowest amount for now.
 * Future updates will provide more accurate estimates
 */
function useAptosEstimatedGasPrice(
  opts: UseAptosEstimatedGasPriceOptions = {}
): AptosGasPrice | undefined {
  const query = useQuery(
    ['aptos', 'estimated-gas-price'],
    async () => {
      const client = new AptosClient(getRpcUrl())
      return client.estimateGasPrice()
    },
    {
      refetchOnMount: false,
      refetchIntervalInBackground: true,
      refetchInterval: 3000,
      ...opts,
    }
  )

  if (query.data) {
    return {
      fast: query.data.prioritized_gas_estimate ?? 0,
      standard: query.data.gas_estimate,
      slow: query.data.deprioritized_gas_estimate ?? 0,
      time: Date.now(),
    }
  }

  return undefined
}

type UseAptosTransactionsGasPriceOptions = {
  enabled?: boolean
  refetchInterval?: number
  numTx?: 5 | 10 | 25 | 50
}

function useAptosTransactionsGasPrice(
  opts: UseAptosTransactionsGasPriceOptions = {}
): AptosGasPrice | undefined {
  const { numTx: numTxOpts, ...axiosOpts } = opts
  const query = useQuery(
    ['aptos', 'estimated-gas-price'],
    async () => {
      const client = new AptosClient(getRpcUrl())
      return client.getTransactions({ limit: numTxOpts ?? 5 })
    },
    {
      refetchOnMount: false,
      refetchIntervalInBackground: true,
      refetchInterval: 3000,
      ...axiosOpts,
    }
  )
  const time = Date.now()

  if (query.data) {
    if (isEnv('development')) {
      console.debug(
        time,
        query.data
          .filter((tx: any) => typeof tx.gas_unit_price !== 'undefined')
          .map(
            (tx: any) =>
              `v ${tx.version} p ${tx.gas_unit_price ?? 0} u ${
                tx.gas_used ?? 0
              }`
          )
      )
    }

    const [totalTxsGasUnitPrices, numTxs, maxPrice, minPrice] =
      query.data.reduce(
        (acc, tx) => {
          if ('gas_unit_price' in tx && 'gas_used' in tx) {
            const txGasUnitPrice = parseInt(tx.gas_unit_price, 10)
            if (isNaN(txGasUnitPrice)) {
              return acc
            }

            const [total, count, max, min] = acc
            return [
              total + txGasUnitPrice,
              count + 1,
              Math.max(max, txGasUnitPrice),
              Math.min(min, txGasUnitPrice),
            ]
          }

          return acc
        },
        [0, 0, 0, 1_000_000_000]
      )

    if (numTxs === 0) {
      return undefined
    }

    return {
      fast: maxPrice,
      standard: Math.round(totalTxsGasUnitPrices / numTxs),
      slow: minPrice,
      time: Date.now(),
    }
  }

  return undefined
}

type GasPriceProps = {
  data?: AptosGasPrice
}

function GasPrice(props: GasPriceProps) {
  if (!props.data) {
    return <code>loading ...</code>
  }

  const dataToDisplay = {
    fast: props.data.fast,
    standard: props.data.standard,
    slow: props.data.slow,
  }

  return <code>estimated price (Octa) {JSON.stringify(dataToDisplay, null, 2)}</code>
}

type ChartProps = {
  updates: { value: number; time: number }
}

function Chart(props: ChartProps) {
  const chartRef = useRef<IChartApi | null>(null)
  const dataRef = useRef<ISeriesApi<'Baseline'> | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      // DOM not yet rendered
      return
    }
    if (props.updates.value === 0) {
      // No data, skip chart state update
      return
    }

    if (!chartRef.current) {
      const chart = createChart(containerRef.current, {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
        timeScale: { visible: true, timeVisible: true },
      })
      chartRef.current = chart

      new ResizeObserver((entries) => {
        if (
          entries.length === 0 ||
          entries[0].target !== containerRef.current
        ) {
          return
        }
        const newRect = entries[0].contentRect
        chart.applyOptions({ height: newRect.height, width: newRect.width })
      }).observe(containerRef.current)

      if (!dataRef.current) {
        dataRef.current = chart.addBaselineSeries({
          baseValue: { type: 'price', price: props.updates.value },
          topLineColor: 'rgba( 239, 83, 80, 1)',
          topFillColor1: 'rgba( 239, 83, 80, 0.05)',
          topFillColor2: 'rgba( 239, 83, 80, 0.28)',
          bottomLineColor: 'rgba( 38, 166, 154, 1)',
          bottomFillColor1: 'rgba( 38, 166, 154, 0.28)',
          bottomFillColor2: 'rgba( 38, 166, 154, 0.05)',
        })
      }

      dataRef.current.setData([props.updates] as any)
    }

    if (dataRef.current && props.updates) {
      dataRef.current.update(props.updates as any)
    }
  }, [props.updates])

  return <div className="gas-chart" ref={containerRef}></div>
}

function PriceDashboard() {
  const [isPaused, setPaused] = useState(false)
  const aptosGasPrice = useAptosTransactionsGasPrice({
    numTx: 25,
    enabled: !isPaused,
  })

  return (
    <div>
      <Chart
        updates={{
          value: aptosGasPrice?.standard ?? 0,
          time: Math.round((aptosGasPrice?.time ?? 0) / 1000),
        }}
      />
      <button
        className="pause-btn"
        onClick={() => setPaused((current) => !current)}
      >
        {isPaused ? 'resume' : 'pause'}
      </button>
      <GasPrice data={aptosGasPrice} />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <h1>Aptos Gas Unit Price</h1>
      <PriceDashboard />
      <p className="text-muted">
        <small>rpc url: {getRpcUrl()}</small>
      </p>
    </QueryClientProvider>
  )
}

export default App
