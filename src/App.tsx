import React, { useRef, useEffect } from 'react'
import { AptosClient } from 'aptos'
import { getRpcUrl } from './config'
import { useQuery, QueryClient, QueryClientProvider } from 'react-query'
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts'

const queryClient = new QueryClient()

type AptosGasPrice = {
  fast: number
  standard: number
  slow: number
  time: number
}

type UseAptosGasPriceOptions = {
  refetchInterval?: number
}

function useAptosEstimatedGasPrice(
  opts: UseAptosGasPriceOptions = {}
): AptosGasPrice | undefined {
  const query = useQuery(
    ['aptos', 'estimated-gas-price'],
    async () => {
      const client = new AptosClient(getRpcUrl())
      return client.estimateGasPrice()
    },
    {
      refetchOnMount: false,
      refetchInterval: 1000,
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

type GasPriceProps = {
  data?: AptosGasPrice
}

function GasPrice(props: GasPriceProps) {
  return (
    <code>
      {props.data ? JSON.stringify(props.data, null, 2) : 'loading ...'}
    </code>
  )
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
        width: 800,
        height: 400,
        timeScale: { visible: true, timeVisible: true },
      })
      chartRef.current = chart

      if (!dataRef.current) {
        dataRef.current = chart.addBaselineSeries({
          baseValue: { type: 'price', price: props.updates.value },
          topLineColor: 'rgba( 38, 166, 154, 1)',
          topFillColor1: 'rgba( 38, 166, 154, 0.28)',
          topFillColor2: 'rgba( 38, 166, 154, 0.05)',
          bottomLineColor: 'rgba( 239, 83, 80, 1)',
          bottomFillColor1: 'rgba( 239, 83, 80, 0.05)',
          bottomFillColor2: 'rgba( 239, 83, 80, 0.28)',
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
  const aptosGasPrice = useAptosEstimatedGasPrice({ refetchInterval: 1000 })

  return (
    <div>
      <Chart
        updates={{
          value: aptosGasPrice?.standard ?? 0,
          time: Math.round((aptosGasPrice?.time ?? 0) / 1000),
        }}
      />
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
