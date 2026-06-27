// 持久的客户端实例 id（spec §3.1 hello.clientId）：每设备一份，便于 Host 关联设备。
const KEY = "htybox.ios.clientId";

export function getClientId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
