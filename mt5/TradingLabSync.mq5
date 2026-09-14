#property copyright "TradingLab"
#property version   "1.001"
#property strict
#property description "Read-only bridge: sends account snapshots to TradingLab. It never trades."

input string ApiUrl = "https://tradinglab-beryl.vercel.app/api/mt5/snapshot";
input string IngestToken = "PASTE_YOUR_INGEST_TOKEN";
input int SyncEverySeconds = 30;
input int HistoryDays = 7;
input string WatchedSymbols = "BTCUSD,GOLD";

bool syncing=false;
datetime lastSnapshotAttempt=0;

string EscapeJson(string value) {
   StringReplace(value,"\\","\\\\");
   StringReplace(value,"\"","\\\"");
   StringReplace(value,"\r","\\r");
   StringReplace(value,"\n","\\n");
   return value;
}

string Num(double value,int digits=8) { return DoubleToString(value,digits); }
string IsoTime(datetime value) {
   MqlDateTime part; TimeToStruct(value,part);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",part.year,part.mon,part.day,part.hour,part.min,part.sec);
}

string PositionJson(ulong ticket) {
   if(!PositionSelectByTicket(ticket)) return "";
   long type=PositionGetInteger(POSITION_TYPE);
   return "{\"ticket\":\""+(string)ticket+"\",\"symbol\":\""+EscapeJson(PositionGetString(POSITION_SYMBOL))+"\","
      "\"side\":\""+(type==POSITION_TYPE_BUY ? "buy" : "sell")+"\","
      "\"volume\":"+Num(PositionGetDouble(POSITION_VOLUME))+","
      "\"priceOpen\":"+Num(PositionGetDouble(POSITION_PRICE_OPEN))+","
      "\"priceCurrent\":"+Num(PositionGetDouble(POSITION_PRICE_CURRENT))+","
      "\"sl\":"+Num(PositionGetDouble(POSITION_SL))+",\"tp\":"+Num(PositionGetDouble(POSITION_TP))+","
      "\"profit\":"+Num(PositionGetDouble(POSITION_PROFIT),2)+",\"swap\":"+Num(PositionGetDouble(POSITION_SWAP),2)+"}";
}

string PositionsJson() {
   string json="["; bool first=true;
   for(int i=0;i<PositionsTotal();i++) {
      ulong ticket=PositionGetTicket(i); string item=PositionJson(ticket); if(item=="") continue;
      if(!first) json+=","; json+=item; first=false;
   }
   return json+"]";
}

string DealsJson() {
   datetime to=TimeCurrent(), from=to-(HistoryDays*86400);
   if(!HistorySelect(from,to)) return "[]";
   string json="["; bool first=true; int added=0;
   for(int i=HistoryDealsTotal()-1;i>=0 && added<100;i--) {
      ulong ticket=HistoryDealGetTicket(i); if(ticket==0) continue;
      long entry=HistoryDealGetInteger(ticket,DEAL_ENTRY);
      long type=HistoryDealGetInteger(ticket,DEAL_TYPE);
      if(type!=DEAL_TYPE_BUY && type!=DEAL_TYPE_SELL) continue;
      string item="{\"ticket\":\""+(string)ticket+"\",\"orderTicket\":\""+(string)HistoryDealGetInteger(ticket,DEAL_ORDER)+"\","
         "\"positionTicket\":\""+(string)HistoryDealGetInteger(ticket,DEAL_POSITION_ID)+"\","
         "\"symbol\":\""+EscapeJson(HistoryDealGetString(ticket,DEAL_SYMBOL))+"\","
         "\"side\":\""+(type==DEAL_TYPE_BUY ? "buy" : "sell")+"\","
         "\"entry\":\""+(entry==DEAL_ENTRY_IN ? "in" : entry==DEAL_ENTRY_OUT ? "out" : "inout")+"\","
         "\"volume\":"+Num(HistoryDealGetDouble(ticket,DEAL_VOLUME))+",\"price\":"+Num(HistoryDealGetDouble(ticket,DEAL_PRICE))+","
         "\"profit\":"+Num(HistoryDealGetDouble(ticket,DEAL_PROFIT),2)+",\"commission\":"+Num(HistoryDealGetDouble(ticket,DEAL_COMMISSION),2)+","
         "\"swap\":"+Num(HistoryDealGetDouble(ticket,DEAL_SWAP),2)+",\"time\":\""+IsoTime((datetime)HistoryDealGetInteger(ticket,DEAL_TIME))+"\"}";
      if(!first) json+=","; json+=item; first=false; added++;
   }
   return json+"]";
}

string SymbolJson(string symbol) {
   StringTrimLeft(symbol); StringTrimRight(symbol);
   if(symbol=="" || !SymbolSelect(symbol,true)) return "";
   return "{\"symbol\":\""+EscapeJson(symbol)+"\",\"contractSize\":"+Num(SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE))+","
      "\"tickSize\":"+Num(SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE))+",\"tickValue\":"+Num(SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE))+","
      "\"volumeMin\":"+Num(SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN))+",\"volumeStep\":"+Num(SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP))+","
      "\"bid\":"+Num(SymbolInfoDouble(symbol,SYMBOL_BID))+",\"ask\":"+Num(SymbolInfoDouble(symbol,SYMBOL_ASK))+"}";
}

string SymbolsJson() {
   string names[]; int count=StringSplit(WatchedSymbols,',',names); string json="["; bool first=true;
   for(int i=0;i<count;i++) { string item=SymbolJson(names[i]); if(item=="") continue; if(!first) json+=","; json+=item; first=false; }
   return json+"]";
}

void SendSnapshot() {
   if(syncing || ApiUrl=="" || IngestToken=="" || IngestToken=="PASTE_YOUR_INGEST_TOKEN" || TimeGMT()-lastSnapshotAttempt<25)return; syncing=true;lastSnapshotAttempt=TimeGMT();
   string body="{\"login\":\""+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"\",\"server\":\""+EscapeJson(AccountInfoString(ACCOUNT_SERVER))+"\","
      "\"currency\":\""+EscapeJson(AccountInfoString(ACCOUNT_CURRENCY))+"\",\"capturedAt\":\""+IsoTime(TimeGMT())+"\","
      "\"balance\":"+Num(AccountInfoDouble(ACCOUNT_BALANCE),2)+",\"equity\":"+Num(AccountInfoDouble(ACCOUNT_EQUITY),2)+","
      "\"margin\":"+Num(AccountInfoDouble(ACCOUNT_MARGIN),2)+",\"freeMargin\":"+Num(AccountInfoDouble(ACCOUNT_MARGIN_FREE),2)+","
      "\"marginLevel\":"+Num(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL),2)+",\"positions\":"+PositionsJson()+",\"deals\":"+DealsJson()+",\"symbols\":"+SymbolsJson()+"}";
   char data[],result[]; string responseHeaders;
   int size=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8); if(size>0) ArrayResize(data,size-1);
   string headers="Content-Type: application/json\r\nAuthorization: Bearer "+IngestToken+"\r\n";
   ResetLastError(); int status=WebRequest("POST",ApiUrl,headers,10000,data,result,responseHeaders);
   if(status==200) Comment("TradingLab conectado · ",TimeToString(TimeLocal(),TIME_SECONDS));
   else { Print("TradingLab sync failed. HTTP=",status," error=",GetLastError()," response=",CharArrayToString(result)); Comment("TradingLab sin conexión · revisa Expert log"); }
   syncing=false;
}

int OnInit() {
   if(SyncEverySeconds<25||IngestToken==""||IngestToken=="PASTE_YOUR_INGEST_TOKEN") { Print("TradingLabSync: intervalo o token inválido"); return INIT_PARAMETERS_INCORRECT; }
   EventSetTimer(SyncEverySeconds); SendSnapshot(); return INIT_SUCCEEDED;
}
void OnTimer() { SendSnapshot(); }
void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result) { SendSnapshot(); }
void OnDeinit(const int reason) { EventKillTimer(); Comment(""); }
