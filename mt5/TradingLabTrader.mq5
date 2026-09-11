#property copyright "TradingLab"
#property version   "0.10"
#property strict
#property description "BTCUSD guarded strategy. Shadow by default; demo execution requires two explicit switches."

#include <Trade/Trade.mqh>

enum TradingLabMode { MODE_SHADOW=0, MODE_DEMO=1 };

input string DecisionApiUrl = "https://tradinglab-beryl.vercel.app/api/mt5/decision";
input string IngestToken = "PASTE_YOUR_INGEST_TOKEN";
input TradingLabMode RunMode = MODE_SHADOW;
input bool EnableDemoExecution = false;
input string StrategySymbol = "BTCUSD";
input int MexicoUtcOffsetHours = -6;
input int EntryStartHour = 5;
input int EntryStartMinute = 0;
input int EntryCutoffHour = 10;
input int EntryCutoffMinute = 30;
input int SessionEndHour = 11;
input int SessionEndMinute = 0;
input double RiskPercent = 0.25;
input double RewardRisk = 2.0;
input double DailyLossLimitPercent = 1.0;
input int MaxConsecutiveLosses = 3;
input double MaxSpreadAtrPercent = 5.0;
input ulong MagicNumber = 260911;

CTrade trade;
int h1FastHandle=INVALID_HANDLE,h1SlowHandle=INVALID_HANDLE,m15EmaHandle=INVALID_HANDLE,m15AtrHandle=INVALID_HANDLE,m5EmaHandle=INVALID_HANDLE;
datetime lastM5Bar=0;

string EscapeJson(string value){StringReplace(value,"\\","\\\\");StringReplace(value,"\"","\\\"");StringReplace(value,"\r","\\r");StringReplace(value,"\n","\\n");return value;}
string NumOrNull(double value,int digits=8){if(value==EMPTY_VALUE||!MathIsValidNumber(value))return "null";return DoubleToString(value,digits);}
string IsoTime(datetime value){MqlDateTime part;TimeToStruct(value,part);return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",part.year,part.mon,part.day,part.hour,part.min,part.sec);}
string ModeName(){return RunMode==MODE_DEMO?"demo":"shadow";}

bool ReadValue(int handle,int shift,double &value){double values[1];if(handle==INVALID_HANDLE||CopyBuffer(handle,0,shift,1,values)!=1)return false;value=values[0];return MathIsValidNumber(value);}
datetime BrokerTimeToGmt(datetime brokerTime){return TimeGMT()-(TimeCurrent()-brokerTime);}
int MexicoMinute(){datetime local=TimeGMT()+MexicoUtcOffsetHours*3600;MqlDateTime p;TimeToStruct(local,p);return p.hour*60+p.min;}
bool InEntryWindow(){int now=MexicoMinute(),start=EntryStartHour*60+EntryStartMinute,cutoff=EntryCutoffHour*60+EntryCutoffMinute;return now>=start&&now<cutoff;}
bool InManagementWindow(){int now=MexicoMinute(),cutoff=EntryCutoffHour*60+EntryCutoffMinute,end=SessionEndHour*60+SessionEndMinute;return now>=cutoff&&now<end;}

void SendDecision(string verdict,string side,string reason,datetime candleTime,double entry=EMPTY_VALUE,double sl=EMPTY_VALUE,double tp=EMPTY_VALUE,double spreadPoints=EMPTY_VALUE,double h1Fast=EMPTY_VALUE,double h1Slow=EMPTY_VALUE,double m15Ema=EMPTY_VALUE,double m15Atr=EMPTY_VALUE,double m5Ema=EMPTY_VALUE){
  string body="{\"login\":\""+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"\",\"server\":\""+EscapeJson(AccountInfoString(ACCOUNT_SERVER))+"\",\"symbol\":\""+EscapeJson(StrategySymbol)+"\",\"timeframe\":\"M5\",\"mode\":\""+ModeName()+"\",\"verdict\":\""+verdict+"\",\"side\":"+(side==""?"null":"\""+side+"\"")+",\"reason\":\""+EscapeJson(reason)+"\",\"candleTime\":\""+IsoTime(BrokerTimeToGmt(candleTime))+"\",\"evaluatedAt\":\""+IsoTime(TimeGMT())+"\",\"entryPrice\":"+NumOrNull(entry)+",\"stopLoss\":"+NumOrNull(sl)+",\"takeProfit\":"+NumOrNull(tp)+",\"riskPercent\":"+DoubleToString(RiskPercent,4)+",\"rewardRisk\":"+DoubleToString(RewardRisk,4)+",\"spreadPoints\":"+NumOrNull(spreadPoints,2)+",\"h1Fast\":"+NumOrNull(h1Fast)+",\"h1Slow\":"+NumOrNull(h1Slow)+",\"m15Ema\":"+NumOrNull(m15Ema)+",\"m15Atr\":"+NumOrNull(m15Atr)+",\"m5Ema\":"+NumOrNull(m5Ema)+"}";
  char data[],result[];string responseHeaders;int size=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);if(size>0)ArrayResize(data,size-1);
  string headers="Content-Type: application/json\r\nAuthorization: Bearer "+IngestToken+"\r\n";ResetLastError();int status=WebRequest("POST",DecisionApiUrl,headers,10000,data,result,responseHeaders);
  if(status!=200)Print("TradingLab decision sync failed. HTTP=",status," error=",GetLastError()," response=",CharArrayToString(result));
}

int OpenPositions(){int count=0;for(int i=0;i<PositionsTotal();i++){if(PositionGetTicket(i)>0)count++;}return count;}

void DailyStats(double &net,int &consecutiveLosses){
  net=0;consecutiveLosses=0;datetime now=TimeGMT(),mexico=now+MexicoUtcOffsetHours*3600;MqlDateTime p;TimeToStruct(mexico,p);p.hour=0;p.min=0;p.sec=0;datetime fromGmt=StructToTime(p)-MexicoUtcOffsetHours*3600;
  datetime fromServer=TimeCurrent()-(TimeGMT()-fromGmt);if(!HistorySelect(fromServer,TimeCurrent()))return;
  for(int i=0;i<HistoryDealsTotal();i++){ulong ticket=HistoryDealGetTicket(i);if(ticket==0||HistoryDealGetInteger(ticket,DEAL_ENTRY)!=DEAL_ENTRY_OUT)continue;net+=HistoryDealGetDouble(ticket,DEAL_PROFIT)+HistoryDealGetDouble(ticket,DEAL_COMMISSION)+HistoryDealGetDouble(ticket,DEAL_SWAP);}
  for(int i=HistoryDealsTotal()-1;i>=0;i--){ulong ticket=HistoryDealGetTicket(i);if(ticket==0||HistoryDealGetInteger(ticket,DEAL_ENTRY)!=DEAL_ENTRY_OUT)continue;double result=HistoryDealGetDouble(ticket,DEAL_PROFIT)+HistoryDealGetDouble(ticket,DEAL_COMMISSION)+HistoryDealGetDouble(ticket,DEAL_SWAP);if(result<0)consecutiveLosses++;else if(result>0)break;}
}

double VolumeForRisk(double entry,double stop){
  double tickSize=SymbolInfoDouble(StrategySymbol,SYMBOL_TRADE_TICK_SIZE),tickValue=SymbolInfoDouble(StrategySymbol,SYMBOL_TRADE_TICK_VALUE),step=SymbolInfoDouble(StrategySymbol,SYMBOL_VOLUME_STEP),minimum=SymbolInfoDouble(StrategySymbol,SYMBOL_VOLUME_MIN),maximum=SymbolInfoDouble(StrategySymbol,SYMBOL_VOLUME_MAX);
  if(tickSize<=0||tickValue<=0||step<=0||entry==stop)return 0;
  double budget=AccountInfoDouble(ACCOUNT_EQUITY)*RiskPercent/100.0,lossPerLot=MathAbs(entry-stop)/tickSize*tickValue,volume=MathFloor((budget/lossPerLot)/step)*step;
  if(volume<minimum)return 0;return MathMin(volume,maximum);
}

void Evaluate(){
  MqlRates m5[8],m15[2];ArraySetAsSeries(m5,true);ArraySetAsSeries(m15,true);if(CopyRates(StrategySymbol,PERIOD_M5,0,8,m5)<8||CopyRates(StrategySymbol,PERIOD_M15,0,2,m15)<2)return;
  datetime closedBar=m5[1].time;if(closedBar==lastM5Bar)return;lastM5Bar=closedBar;
  double h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1,m5Ema2;if(!ReadValue(h1FastHandle,1,h1Fast)||!ReadValue(h1SlowHandle,1,h1Slow)||!ReadValue(m15EmaHandle,1,m15Ema)||!ReadValue(m15AtrHandle,1,m15Atr)||!ReadValue(m5EmaHandle,1,m5Ema1)||!ReadValue(m5EmaHandle,2,m5Ema2)){SendDecision("error","","No se pudieron leer los indicadores",closedBar);return;}
  MqlTick tick;if(!SymbolInfoTick(StrategySymbol,tick)){SendDecision("error","","No se pudo leer el precio de BTCUSD",closedBar);return;}double point=SymbolInfoDouble(StrategySymbol,SYMBOL_POINT),spreadPoints=point>0?(tick.ask-tick.bid)/point:EMPTY_VALUE;
  if(!InEntryWindow()){SendDecision("outside_session","",InManagementWindow()?"Ventana de gestión: no se permiten entradas nuevas":"Sesión cerrada: las posiciones conservan SL y TP",closedBar,EMPTY_VALUE,EMPTY_VALUE,EMPTY_VALUE,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);return;}
  if(OpenPositions()>0){SendDecision("blocked","","Ya existe una posición abierta; una tesis, un riesgo",closedBar,EMPTY_VALUE,EMPTY_VALUE,EMPTY_VALUE,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);return;}
  double dayNet;int losses;DailyStats(dayNet,losses);double equity=AccountInfoDouble(ACCOUNT_EQUITY),balance=AccountInfoDouble(ACCOUNT_BALANCE);if((balance>0&&dayNet<=-balance*DailyLossLimitPercent/100.0)||losses>=MaxConsecutiveLosses){SendDecision("blocked","","Límite diario o racha máxima de pérdidas alcanzada",closedBar,EMPTY_VALUE,EMPTY_VALUE,EMPTY_VALUE,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);return;}
  if(m15Atr<=0||(tick.ask-tick.bid)>m15Atr*MaxSpreadAtrPercent/100.0){SendDecision("blocked","","Spread demasiado amplio respecto al ATR M15",closedBar,EMPTY_VALUE,EMPTY_VALUE,EMPTY_VALUE,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);return;}
  bool buy=h1Fast>h1Slow&&m15[1].close>m15Ema&&m5[2].close<=m5Ema2&&m5[1].close>m5Ema1&&m5[1].close>m5[1].open;
  bool sell=h1Fast<h1Slow&&m15[1].close<m15Ema&&m5[2].close>=m5Ema2&&m5[1].close<m5Ema1&&m5[1].close<m5[1].open;
  if(!buy&&!sell){SendDecision("no_setup","","Tendencia y retroceso M5 no están alineados",closedBar,EMPTY_VALUE,EMPTY_VALUE,EMPTY_VALUE,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);return;}
  double entry=buy?tick.ask:tick.bid,stop=buy?m5[1].low:m5[1].high;for(int i=2;i<=6;i++){if(buy)stop=MathMin(stop,m5[i].low);else stop=MathMax(stop,m5[i].high);}stop+=buy?-m15Atr*0.10:m15Atr*0.10;
  double distance=MathAbs(entry-stop);if(distance<=0){SendDecision("blocked",buy?"buy":"sell","Stop técnico inválido",closedBar,entry,stop,EMPTY_VALUE,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);return;}double target=buy?entry+distance*RewardRisk:entry-distance*RewardRisk,volume=VolumeForRisk(entry,stop);
  int digits=(int)SymbolInfoInteger(StrategySymbol,SYMBOL_DIGITS);entry=NormalizeDouble(entry,digits);stop=NormalizeDouble(stop,digits);target=NormalizeDouble(target,digits);
  if(volume<=0){SendDecision("blocked",buy?"buy":"sell","El volumen mínimo de XM excede el riesgo permitido",closedBar,entry,stop,target,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);return;}
  if(RunMode==MODE_SHADOW){SendDecision("signal",buy?"buy":"sell","Señal válida en sombra; no se envió ninguna orden",closedBar,entry,stop,target,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);Comment("TradingLab sombra · ",buy?"COMPRA":"VENTA"," · SL ",DoubleToString(stop,digits)," · TP ",DoubleToString(target,digits));return;}
  if(!EnableDemoExecution||AccountInfoInteger(ACCOUNT_TRADE_MODE)!=ACCOUNT_TRADE_MODE_DEMO){SendDecision("blocked",buy?"buy":"sell","Ejecución bloqueada: requiere interruptor explícito y cuenta demo",closedBar,entry,stop,target,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);return;}
  trade.SetExpertMagicNumber(MagicNumber);trade.SetTypeFillingBySymbol(StrategySymbol);bool sent=buy?trade.Buy(volume,StrategySymbol,0,stop,target,"TradingLab demo"):trade.Sell(volume,StrategySymbol,0,stop,target,"TradingLab demo");
  SendDecision(sent?"order_sent":"error",buy?"buy":"sell",sent?"Orden demo enviada con SL y TP":"MT5 rechazó la orden: "+trade.ResultRetcodeDescription(),closedBar,entry,stop,target,spreadPoints,h1Fast,h1Slow,m15Ema,m15Atr,m5Ema1);
}

int OnInit(){
  if(!SymbolSelect(StrategySymbol,true)||RiskPercent<=0||RiskPercent>0.25||RewardRisk<2.0){Print("Parámetros de seguridad inválidos");return INIT_PARAMETERS_INCORRECT;}
  h1FastHandle=iMA(StrategySymbol,PERIOD_H1,50,0,MODE_EMA,PRICE_CLOSE);h1SlowHandle=iMA(StrategySymbol,PERIOD_H1,200,0,MODE_EMA,PRICE_CLOSE);m15EmaHandle=iMA(StrategySymbol,PERIOD_M15,50,0,MODE_EMA,PRICE_CLOSE);m15AtrHandle=iATR(StrategySymbol,PERIOD_M15,14);m5EmaHandle=iMA(StrategySymbol,PERIOD_M5,20,0,MODE_EMA,PRICE_CLOSE);
  if(h1FastHandle==INVALID_HANDLE||h1SlowHandle==INVALID_HANDLE||m15EmaHandle==INVALID_HANDLE||m15AtrHandle==INVALID_HANDLE||m5EmaHandle==INVALID_HANDLE)return INIT_FAILED;
  EventSetTimer(5);Comment("TradingLabTrader · ",RunMode==MODE_SHADOW?"SOMBRA":"DEMO"," · BTCUSD");return INIT_SUCCEEDED;
}
void OnTimer(){Evaluate();}
void OnTick(){Evaluate();}
void OnDeinit(const int reason){EventKillTimer();if(h1FastHandle!=INVALID_HANDLE)IndicatorRelease(h1FastHandle);if(h1SlowHandle!=INVALID_HANDLE)IndicatorRelease(h1SlowHandle);if(m15EmaHandle!=INVALID_HANDLE)IndicatorRelease(m15EmaHandle);if(m15AtrHandle!=INVALID_HANDLE)IndicatorRelease(m15AtrHandle);if(m5EmaHandle!=INVALID_HANDLE)IndicatorRelease(m5EmaHandle);Comment("");}
