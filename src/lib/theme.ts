import { createContext, useContext } from 'react'

export type Mode = 'dark' | 'light'

/** Chart colours per mode. Categorical slots are fixed-order and validated (dataviz reference palette). */
export const CHART = {
  light: {
    primary: '#2457d6',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    seq: ['#eef0f3', '#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95'],
    good: '#17803d',
    grid: '#eceef1',
    axis: '#9a9ea6',
    text: '#17181c',
    text2: '#5f636b',
    surface: '#ffffff',
  },
  dark: {
    primary: '#6b97ff',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    seq: ['#1d1f23', '#104281', '#1c5cab', '#2a78d6', '#5598e7', '#9ec5f4'],
    good: '#4cc27a',
    grid: '#24262b',
    axis: '#6e7178',
    text: '#eeeef0',
    text2: '#a3a6ad',
    surface: '#111214',
  },
}

export type ChartTheme = (typeof CHART)['light']

export const ThemeCtx = createContext<ChartTheme>(CHART.light)
export const useChart = () => useContext(ThemeCtx)
