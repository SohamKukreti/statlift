import { createContext, useContext } from 'react'

export type Mode = 'dark' | 'light'

/** Chart colours per mode. Categorical slots are fixed-order and validated (dataviz reference palette). */
export const CHART = {
  light: {
    primary: '#2447c7',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    seq: ['#eef0f3', '#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95'],
    good: '#17803d',
    grid: '#ebe8e1',
    axis: '#8f8b84',
    text: '#111111',
    text2: '#5d5a55',
    surface: '#ffffff',
  },
  dark: {
    primary: '#93a8ff',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    seq: ['#222327', '#104281', '#1c5cab', '#2a78d6', '#5598e7', '#9ec5f4'],
    good: '#6fcf8f',
    grid: '#2b2c31',
    axis: '#85827b',
    text: '#ecebe7',
    text2: '#a8a59e',
    surface: '#17181b',
  },
}

export type ChartTheme = (typeof CHART)['light']

export const ThemeCtx = createContext<ChartTheme>(CHART.light)
export const useChart = () => useContext(ThemeCtx)
