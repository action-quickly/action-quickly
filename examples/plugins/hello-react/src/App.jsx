import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

function App() {
  const [params, setParams] = useState({});
  const [info, setInfo] = useState({});

  // Clipboard
  const clipRef = useRef();
  const [clipOut, setClipOut] = useState('操作剪贴板...');

  // Notification
  const [notifTitle, setNotifTitle] = useState('ActionQuick');
  const [notifBody, setNotifBody] = useState('来自 React 插件的通知');
  const [notifOut, setNotifOut] = useState('通知结果...');

  // Storage
  const [stKey, setStKey] = useState('theme');
  const [stVal, setStVal] = useState('dark');
  const [stOut, setStOut] = useState('存储结果...');

  // HTTP
  const [httpMethod, setHttpMethod] = useState('GET');
  const [httpUrl, setHttpUrl] = useState('https://httpbin.org/get');
  const [httpBody, setHttpBody] = useState('{"test":1}');
  const [httpOut, setHttpOut] = useState('HTTP 结果...');

  // UI
  const [uiOut, setUiOut] = useState('UI 操作结果...');

  // Events
  const [evtName, setEvtName] = useState('hello:ping');
  const [evtData, setEvtData] = useState('{"from":"hello-react"}');
  const [evtOut, setEvtOut] = useState('事件系统...');
  const subRef = useRef(false);

  // Invoke
  const [invCmd, setInvCmd] = useState('aq_storage_keys');
  const [invArgs, setInvArgs] = useState('{}');
  const [invOut, setInvOut] = useState('invoke 结果...');

  // Filesystem
  const [fsPath, setFsPath] = useState('plugin_data/hello.txt');
  const [fsContent, setFsContent] = useState('Hello from React Plugin!');
  const [fsOut, setFsOut] = useState('文件系统...');

  const aq = window.aq;

  useEffect(() => {
    function handleMessage(e) {
      const d = e.data;
      if (!d || d.source !== 'action-quick-host') return;
      if (d.type === 'aq-init-bridge' && d.script) { try { eval(d.script); } catch(x){} return; }
      if (d.type === 'plugin-params') setParams(d.params);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (aq) {
      setInfo({ version: aq.version, pluginId: aq.pluginId });
    }
  }, []);

  // Clipboard
  const clipWrite = useCallback(async () => {
    try {
      await aq.clipboard.write(clipRef.current.value);
      setClipOut('✓ 已写入: "' + clipRef.current.value + '"');
    } catch (e) { setClipOut('✗ 写入失败: ' + e); }
  }, []);

  const clipWriteTime = useCallback(async () => {
    const t = '当前时间: ' + new Date().toLocaleString();
    try { await aq.clipboard.write(t); setClipOut('✓ 已写入: "' + t + '"'); }
    catch (e) { setClipOut('✗ 写入失败: ' + e); }
  }, []);

  const clipRead = useCallback(async () => {
    try { const t = await aq.clipboard.read(); setClipOut('✓ 读取结果: "' + t + '"'); }
    catch (e) { setClipOut('✗ 读取失败: ' + e); }
  }, []);

  // Notification
  const notifSend = useCallback(async () => {
    try { await aq.notification.show({ title: notifTitle, body: notifBody }); setNotifOut('✓ 通知已发送'); }
    catch (e) { setNotifOut('✗ 通知失败: ' + e); }
  }, [notifTitle, notifBody]);
  const notifHello = useCallback(async () => {
    try { await aq.notification.show({ title: 'ActionQuick', body: '你好！来自 React 插件' }); setNotifOut('✓ 通知已发送'); }
    catch (e) { setNotifOut('✗ 通知失败: ' + e); }
  }, []);

  // Storage
  const stSet = useCallback(async () => {
    try { await aq.storage.set(stKey, stVal); setStOut('✓ 已写入: ' + stKey + ' = ' + stVal); }
    catch (e) { setStOut('✗ 写入失败: ' + e); }
  }, [stKey, stVal]);
  const stGet = useCallback(async () => {
    try { const v = await aq.storage.get(stKey); setStOut('✓ ' + stKey + ' = <span class="val">' + JSON.stringify(v) + '</span>'); }
    catch (e) { setStOut('✗ 读取失败: ' + e); }
  }, [stKey]);
  const stDel = useCallback(async () => {
    try { await aq.storage.delete(stKey); setStOut('✓ 已删除: ' + stKey); }
    catch (e) { setStOut('✗ 删除失败: ' + e); }
  }, [stKey]);
  const stKeys = useCallback(async () => {
    try { const keys = await aq.invoke('aq_storage_keys'); setStOut('✓ 所有 key: <span class="val">' + JSON.stringify(keys) + '</span>'); }
    catch (e) { setStOut('✗ 获取失败: ' + e); }
  }, []);
  const stClear = useCallback(async () => {
    try { const keys = await aq.invoke('aq_storage_keys'); await Promise.all(keys.map(k => aq.storage.delete(k))); setStOut('✓ 已清除 ' + keys.length + ' 个 key'); }
    catch (e) { setStOut('✗ 清除失败: ' + e); }
  }, []);

  // HTTP
  const doHttp = useCallback(async (method, url, body) => {
    setHttpOut('请求中...');
    try {
      const resp = method === 'GET' ? await aq.http.get(url) : await aq.http.post(url, body);
      const s = typeof resp === 'string' ? resp : JSON.stringify(resp);
      setHttpOut('✓ ' + method + ' ' + url + ' → <span class="val">' + s.substring(0, 300) + '</span>');
    } catch (e) { setHttpOut('✗ 请求失败: ' + e); }
  }, []);
  const httpSend = useCallback(() => doHttp(httpMethod, httpUrl, httpBody), [httpMethod, httpUrl, httpBody, doHttp]);

  // UI
  const uiToast = useCallback(async (msg, type) => {
    aq.ui.showToast(msg, type);
    setUiOut('✓ 已发送 ' + (type || 'info') + ' toast');
  }, []);
  const uiModal = useCallback(async () => {
    try { const r = await aq.ui.showModal({ title: 'Hello React', content: '这是 aq.ui.showModal 的演示' }); setUiOut('✓ Modal 返回: <span class="val">' + JSON.stringify(r) + '</span>'); }
    catch (e) { setUiOut('Modal 关闭 (无操作)'); }
  }, []);

  // Events
  const evtEmit = useCallback(() => {
    try { const data = JSON.parse(evtData || '{}'); aq.emit(evtName, data); setEvtOut('✓ 已发射事件: ' + evtName); }
    catch (e) { setEvtOut('✗ 发射失败: ' + e); }
  }, [evtName, evtData]);
  const evtSub = useCallback(() => {
    if (subRef.current) { setEvtOut('已订阅，请勿重复'); return; }
    aq.on('hello:ping', (data) => setEvtOut('收到事件: <span class="val">' + JSON.stringify(data) + '</span>'));
    subRef.current = true;
    setEvtOut('✓ 已订阅 hello:ping');
  }, []);
  const evtUnsub = useCallback(() => {
    subRef.current = false;
    setEvtOut('取消订阅 (页面刷新后重置)');
  }, []);

  // Invoke
  const invSend = useCallback(async () => {
    try { const args = JSON.parse(invArgs || '{}'); const r = await aq.invoke(invCmd, args); setInvOut('✓ ' + invCmd + ' → <span class="val">' + JSON.stringify(r) + '</span>'); }
    catch (e) { setInvOut('✗ ' + invCmd + ' 失败: ' + e); }
  }, [invCmd, invArgs]);

  // FS
  const fsWrite = useCallback(async () => {
    try { await aq.invoke('aq_fs_write', { path: fsPath, content: fsContent }); setFsOut('✓ 已写入: ' + fsPath); }
    catch (e) { setFsOut('✗ 写入失败: ' + e); }
  }, [fsPath, fsContent]);
  const fsRead = useCallback(async () => {
    try { const c = await aq.invoke('aq_fs_read', { path: fsPath }); setFsOut('✓ 读取: ' + fsPath + ' → <span class="val">"' + c + '"</span>'); }
    catch (e) { setFsOut('✗ 读取失败: ' + e); }
  }, [fsPath]);

  return (
    <div>
      <h1>🛠 SDK 能力全览 (React)</h1>
      <div className="subtitle">SDK v{info.version || '?'} | pluginId: {info.pluginId || '?'}</div>

      <div className="statusBar">
        query: <code>{params.query || '无'}</code> &nbsp;|&nbsp; contextText: <code>{params.contextText || '无'}</code>
      </div>

      <div className="grid">
        {/* Info */}
        <div className="card">
          <h3>ℹ️ 基本信息</h3>
          <div className="row"><span className="chip">version</span> <code>{info.version || '-'}</code></div>
          <div className="row"><span className="chip">pluginId</span> <code>{info.pluginId || '-'}</code></div>
          <div className="row"><span className="chip">platform</span> <code>{navigator.platform}</code></div>
        </div>

        {/* Clipboard */}
        <div className="card">
          <h3>📋 剪贴板 <span className="badge">aq.clipboard</span></h3>
          <div className="row fill"><input ref={clipRef} defaultValue="Hello ActionQuick!" /></div>
          <div className="row">
            <button onClick={clipWrite}>写入</button>
            <button onClick={clipRead}>读取</button>
            <button className="orange sm" onClick={clipWriteTime}>写入当前时间</button>
          </div>
          <div className="out" dangerouslySetInnerHTML={{ __html: clipOut }} />
        </div>

        {/* Notification */}
        <div className="card">
          <h3>🔔 通知 <span className="badge">aq.notification</span></h3>
          <div className="row fill"><input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="标题" /></div>
          <div className="row fill"><input value={notifBody} onChange={e => setNotifBody(e.target.value)} placeholder="内容" /></div>
          <div className="row">
            <button onClick={notifSend}>发送通知</button>
            <button className="green sm" onClick={notifHello}>发送 "你好"</button>
          </div>
          <div className="out" dangerouslySetInnerHTML={{ __html: notifOut }} />
        </div>

        {/* Storage */}
        <div className="card">
          <h3>💾 KV 存储 <span className="badge">aq.storage</span></h3>
          <div className="row fill">
            <input value={stKey} onChange={e => setStKey(e.target.value)} placeholder="key" />
            <input value={stVal} onChange={e => setStVal(e.target.value)} placeholder="value" />
          </div>
          <div className="row">
            <button className="green" onClick={stSet}>写入</button>
            <button onClick={stGet}>读取</button>
            <button className="red" onClick={stDel}>删除</button>
            <button className="purple sm" onClick={stKeys}>列出 key</button>
            <button className="orange sm" onClick={stClear}>清除</button>
          </div>
          <div className="out" dangerouslySetInnerHTML={{ __html: stOut }} />
        </div>

        {/* HTTP */}
        <div className="card">
          <h3>🌐 HTTP 请求 <span className="badge">aq.http</span></h3>
          <div className="row fill">
            <select value={httpMethod} onChange={e => setHttpMethod(e.target.value)} style={{width:'70px'}}>
              <option>GET</option><option>POST</option>
            </select>
            <input value={httpUrl} onChange={e => setHttpUrl(e.target.value)} placeholder="URL" />
          </div>
          <div className="row fill">
            <input value={httpBody} onChange={e => setHttpBody(e.target.value)} placeholder="POST body (JSON)" />
          </div>
          <div className="row">
            <button onClick={httpSend}>发送请求</button>
            <button className="green sm" onClick={() => doHttp('GET', 'https://httpbin.org/get', null)}>GET httpbin</button>
            <button className="purple sm" onClick={() => doHttp('POST', 'https://httpbin.org/post', '{"from":"hello-react"}')}>POST httpbin</button>
          </div>
          <div className="out" dangerouslySetInnerHTML={{ __html: httpOut }} />
        </div>

        {/* UI */}
        <div className="card">
          <h3>🖥 UI <span className="badge">aq.ui</span></h3>
          <div className="row">
            <button className="green sm" onClick={() => uiToast('Info Toast')}>Toast Info</button>
            <button className="purple sm" onClick={() => uiToast('Success Toast', 'success')}>Toast Success</button>
            <button className="red sm" onClick={() => uiToast('Error Toast', 'error')}>Toast Error</button>
          </div>
          <div className="row"><button onClick={uiModal}>显示 Modal</button></div>
          <div className="out" dangerouslySetInnerHTML={{ __html: uiOut }} />
        </div>

        {/* Events */}
        <div className="card">
          <h3>📡 事件系统 <span className="badge">aq.on / aq.emit</span></h3>
          <div className="row fill">
            <input value={evtName} onChange={e => setEvtName(e.target.value)} placeholder="事件名" />
            <input value={evtData} onChange={e => setEvtData(e.target.value)} placeholder="JSON" />
          </div>
          <div className="row">
            <button onClick={evtEmit}>发射</button>
            <button className="green sm" onClick={evtSub}>订阅 hello:ping</button>
            <button className="red sm" onClick={evtUnsub}>取消订阅</button>
          </div>
          <div className="out" dangerouslySetInnerHTML={{ __html: evtOut }} />
        </div>

        {/* Invoke */}
        <div className="card">
          <h3>⚙️ invoke 底层 <span className="badge">aq.invoke</span></h3>
          <div className="row fill">
            <select value={invCmd} onChange={e => setInvCmd(e.target.value)}>
              <option value="aq_storage_keys">aq_storage_keys</option>
              <option value="aq_clipboard_read">aq_clipboard_read</option>
              <option value="aq_notification">aq_notification</option>
            </select>
          </div>
          <div className="row fill"><input value={invArgs} onChange={e => setInvArgs(e.target.value)} placeholder="JSON args" /></div>
          <div className="row">
            <button onClick={invSend}>invoke</button>
            <button className="purple sm" onClick={stKeys}>获取所有 key</button>
          </div>
          <div className="out" dangerouslySetInnerHTML={{ __html: invOut }} />
        </div>

        {/* FS */}
        <div className="card">
          <h3>📁 文件系统 <span className="badge">aq.invoke(fs)</span></h3>
          <div className="row fill"><input value={fsPath} onChange={e => setFsPath(e.target.value)} placeholder="路径" /></div>
          <div className="row fill"><input value={fsContent} onChange={e => setFsContent(e.target.value)} placeholder="内容" /></div>
          <div className="row">
            <button className="green" onClick={fsWrite}>写入文件</button>
            <button onClick={fsRead}>读取文件</button>
          </div>
          <div className="out" dangerouslySetInnerHTML={{ __html: fsOut }} />
        </div>
      </div>
    </div>
  );
}

export default App;
