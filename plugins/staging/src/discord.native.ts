import electron from "electron";

const getCurrent = () => {
	return electron.autoUpdater.getFeedURL()
}

const setBeta = (beta: boolean) => {
	electron.autoUpdater.setFeedURL({
		url: electron.autoUpdater.getFeedURL(),
	});
	if (beta) {
		electron.autoUpdater.setFeedURL({
			url: electron.autoUpdater.getFeedURL() + "/beta",
		});
	}
}

electron.ipcMain.removeHandler("UPDATE_GET_CURRENT");
electron.ipcMain.removeHandler("UPDATE_SET_BETA");
electron.ipcMain.handle("UPDATE_GET_CURRENT", getCurrent);
electron.ipcMain.handle("UPDATE_SET_BETA", (event, beta: boolean) => {
	setBeta(beta);
});
