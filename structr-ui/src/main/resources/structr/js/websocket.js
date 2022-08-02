/*
 * Copyright (C) 2010-2022 Structr GmbH
 *
 * This file is part of Structr <http://structr.org>.
 *
 * Structr is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Structr is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Structr.  If not, see <http://www.gnu.org/licenses/>.
 */
let StructrWS = {

	ws: undefined,
	wsWorker: new Worker('js/websocket-worker.js'),
	isAdmin: false,
	skipNext100Code: false,
	user: undefined,
	userId: undefined,
	me: undefined,

	init: () => {

		StructrWS.wsWorker.addEventListener('message', (e) => {

			switch(e.data.type) {

				case 'onopen': {
					StructrWS.onopen(e.data);
					break;
				}
				case 'onclose': {
					StructrWS.onclose(e.data);
					break;
				}
				case 'onmessage': {
					StructrWS.onmessage(e.data);
					break;
				}
				case 'ping': {
					StructrWS.ping();
					break;
				}
			}
		});

		StructrWS.connect();
	},
	getWSConnectionInfo: () => {

		let isEnc   = (window.location.protocol === 'https:');
		let host    = document.location.host;
		let message = {
			wsUrl: 'ws' + (isEnc ? 's' : '') + '://' + host + Structr.wsRoot,
			wsClass: (('WebSocket' in window) === true) ? 'WebSocket' : (('MozWebSocket' in window) ? 'MozWebSocket' : false)
		};

		if (message.wsClass === false) {

			alert('Your browser doesn\'t support WebSocket.');
			return false;
		}

		return message;
	},
	connect: () => {

		let wsInfo = StructrWS.getWSConnectionInfo();
		if (wsInfo === false) {
			return;
		}

		let message = Object.assign({ type: 'connect' }, wsInfo);

		StructrWS.sessionId = Structr.getSessionId();
		if (!StructrWS.sessionId) {
			Structr.renewSessionId(() => {
				StructrWS.wsWorker.postMessage(message);
			});
		} else {
			StructrWS.wsWorker.postMessage(message);
		}
	},
	reconnect: (data) => {

		let wsInfo = StructrWS.getWSConnectionInfo();
		if (wsInfo === false) {
			return;
		}

		let message = Object.assign({ type: 'reconnect' }, wsInfo);

		StructrWS.wsWorker.postMessage(message);
	},
	stopReconnect: () => {
		StructrWS.wsWorker.postMessage({ type: 'stopReconnect' });
	},
	close: () => {
		StructrWS.wsWorker.postMessage({ type: 'close' });
	},
	ping: () => {

		StructrWS.sessionId = Structr.getSessionId();

		if (StructrWS.sessionId) {
			Command.ping();
		} else {
			Structr.renewSessionId(() => {
				Command.ping();
			});
		}
	},
	startPing: () => {
		StructrWS.wsWorker.postMessage({ type: 'startPing' });
	},
	stopPing: () => {
		StructrWS.wsWorker.postMessage({ type: 'stopPing' });
	},
	onopen: (workerMessage) => {

		if ($.unblockUI) {
			$.unblockUI({
				fadeOut: 25
			});
		}

		let wasDisconnect = Structr.moveOffscreenUIOnscreen();

		if (wasDisconnect) {
			StructrWS.skipNext100Code = true;
		}

		StructrWS.stopReconnect();
		Structr.init();
		StructrWS.startPing();
	},
	onclose: (workerMessage) => {

		// Delay reconnect dialog to prevent it popping up before page reload
		window.setTimeout(() => {

			Structr.moveUIOffscreen();

			Structr.reconnectDialog();
			StructrWS.reconnect({ source: 'onclose' });

		}, 100);
	},
	onmessage: (workerMessage) => {

		let data         = JSON.parse(workerMessage.message);
		let type         = data.data.type;
		let command      = data.command;
		let msg          = data.message;
		let result       = data.result;
		let sessionValid = data.sessionValid;
		let code         = data.code;

		if (command === 'LOGIN' || code === 100) {

			if (command === 'LOGIN' || !StructrWS.userId) {
				Command.rest("/me", (result) => {
					StructrWS.userId = result[0].id;
				});
			}

			StructrWS.me      = data.data;
			StructrWS.isAdmin = data.data.isAdmin;

			if (!sessionValid) {

				Structr.clearMain();
				Structr.login(msg);

			} else if (!StructrWS.user || StructrWS.user !== data.data.username || loginBox.is(':visible')) {

				if (StructrWS.skipNext100Code === true) {

					StructrWS.skipNext100Code = false;

				} else {

					Structr.updateUsername(data.data.username);
					loginBox.hide();
					Structr.clearLoginForm();
					$('table.username-password', loginBox).show();
					$('table.twofactor', loginBox).hide();
					Structr.refreshUi((command === 'LOGIN'));
				}
			}

			StructrModel.callCallback(data.callback, data.data[data.data['key']]);

		} else if (command === 'GET_LOCAL_STORAGE') {

			if (data.data.localStorageString && data.data.localStorageString.length) {
				LSWrapper.setAsJSON(data.data.localStorageString);
			}

			StructrModel.callCallback(data.callback, data.data);

		} else if (command === 'CONSOLE') {

			StructrModel.callCallback(data.callback, data);

		} else if (command === 'STATUS') {

			if (code === 403) {
				StructrWS.user   = null;
				StructrWS.userId = null;

				if (data.data.reason === 'sessionLimitExceeded') {
					Structr.login('Max. number of sessions exceeded.');
				} else {
					Structr.login('Wrong username or password!');
				}
			} else if (code === 401) {
				StructrWS.user   = null;
				StructrWS.userId = null;

				if (data.data.reason === 'twofactortoken') {
					Structr.clearLoginForm();
					$('table.username-password', loginBox).show();
					$('table.twofactor', loginBox).hide();
				}
				Structr.login((msg !== null) ? msg : '');

			} else if (code === 202) {
				StructrWS.user   = null;
				StructrWS.userId = null;

				Structr.login('');

				Structr.toggle2FALoginBox(data.data);

			} else {

				let codeStr = code ? code.toString() : '';

				if (codeStr === '422') {
					try {
						StructrModel.callCallback(data.callback, null, null, true);
					} catch (e) {}
				}

				let msgClass;
				let requiresConfirmation = false;
				if (codeStr.startsWith('2')) {
					msgClass = 'success';
				} else if (codeStr.startsWith('3')) {
					msgClass = 'info';
				} else if (codeStr.startsWith('4')) {
					msgClass = 'warning';
					requiresConfirmation = true;
				} else {
					msgClass = 'error';
					requiresConfirmation = true;
				}

				if (data.data.requiresConfirmation) {
					requiresConfirmation = data.data.requiresConfirmation;
				}

				if (msg && msg.startsWith('{')) {

					let msgObj = JSON.parse(msg);

					if (dialogBox.is(':visible')) {

						Structr.showAndHideInfoBoxMessage(msgObj.size + ' bytes saved to ' + msgObj.name, msgClass, 2000, 200);

					} else {

						let node = Structr.node(msgObj.id);

						if (node) {

							let progr = node.find('.progress');
							progr.show();

							let size = parseInt(node.find('.size').text());
							let part = msgObj.size;

							node.find('.part').text(part);
							let pw = node.find('.progress').width();
							let w = pw / size * part;

							node.find('.bar').css({width: w + 'px'});

							if (part >= size) {
								blinkGreen(progr);
								window.setTimeout(function () {
									progr.fadeOut('fast');
									_Files.resize();
								}, 1000);
							}
						}
					}

				} else {

					if (codeStr === "404") {

						let msgBuilder = new MessageBuilder().className(msgClass);

						if (requiresConfirmation) {
							msgBuilder.requiresConfirmation();
						}

						if (data.message) {
							msgBuilder.title('Object not found.').text(data.message);
						} else {
							msgBuilder.text('Object not found.');
						}

						msgBuilder.show();

					} else if (data.error && data.error.errors) {

						Structr.errorFromResponse(data.error, null, { requiresConfirmation: true });

					} else {

						let msgBuilder = new MessageBuilder().className(msgClass).text(msg);

						if (requiresConfirmation) {
							msgBuilder.requiresConfirmation();
						}

						msgBuilder.show();
					}
				}
			}

		} else if (command === 'GET_PROPERTY') {

			StructrModel.updateKey(data.id, data.data['key'], data.data[data.data['key']]);
			StructrModel.callCallback(data.callback, data.data[data.data['key']]);

		} else if (command === 'UPDATE' || command === 'SET_PERMISSION') {

			let modelObj = StructrModel.obj(data.id);

			if (!modelObj) {
				data.data.id = data.id;
				modelObj = StructrModel.create(data.data, null, false);
			} else {
				if (modelObj.updatedModel && (typeof modelObj.updatedModel === 'function')) {
					for (let [key, value] of Object.entries(data.data)) {
						modelObj[key] = value;
					}
					modelObj.updatedModel();
				}
			}

			StructrModel.update(data);

		} else if (command === 'GET' || command === 'GET_RELATIONSHIP' || command === 'GET_PROPERTIES') {

			StructrModel.callCallback(data.callback, result[0]);

		} else if (command.startsWith('GET') || command === 'GET_BY_TYPE' || command === 'GET_SCHEMA_INFO' || command === 'CREATE_RELATIONSHIP') {

			StructrModel.callCallback(data.callback, result);

		} else if (command === 'CHILDREN') {

			if (result.length > 0 && result[0].name) {
				result.sort(function (a, b) {
					return a.name.localeCompare(b.name);
				});
			}

			let refObject = StructrModel.obj(data.id);

			if (refObject && refObject.constructor.name === 'StructrGroup') {

				// let security handle this

			} else {

				for (let entity of result) {
					StructrModel.create(entity);
				}
			}
			StructrModel.callCallback(data.callback, result);

		} else if (command.endsWith('CHILDREN')) {

			for (let entity of result) {
				StructrModel.create(entity);
			}

			StructrModel.callCallback(data.callback, result);

		} else if (command.startsWith('SEARCH')) {

			if (type) {
				$('.pageCount', $('.pager' + type)).val(_Pager.pageCount[type]);
			}

			StructrModel.callCallback(data.callback, result, data.rawResultCount);

		} else if (command.startsWith('LIST_UNATTACHED_NODES')) {

			StructrModel.callCallback(data.callback, result);

		} else if (command.startsWith('LIST_SCHEMA_PROPERTIES')) {

			// send full result in a single callback
			StructrModel.callCallback(data.callback, result);

		} else if (command.startsWith('LIST_COMPONENTS')) {

			StructrModel.callCallback(data.callback, result);

		} else if (command.startsWith('LIST_SYNCABLES')) {

			StructrModel.callCallback(data.callback, result);

		} else if (command.startsWith('LIST_ACTIVE_ELEMENTS')) {

			StructrModel.callCallback(data.callback, result);

		} else if (command.startsWith('LIST_LOCALIZATIONS')) {

			StructrModel.callCallback(data.callback, result);

		} else if (command.startsWith('SNAPSHOTS')) {

			StructrModel.callCallback(data.callback, result);

		} else if (command.startsWith('LIST')) {

			StructrModel.callCallback(data.callback, result, data.rawResultCount);

		} else if (command.startsWith('QUERY')) {

			StructrModel.callCallback(data.callback, result, data.rawResultCount);

		} else if (command.startsWith('CLONE') || command === 'REPLACE_TEMPLATE') {

			StructrModel.callCallback(data.callback, result, data.rawResultCount);

		} else if (command === 'DELETE') {

			StructrModel.del(data.id);

			StructrModel.callCallback(data.callback, [], 0);

		} else if (command === 'INSERT_BEFORE' || command === 'APPEND_CHILD' || command === 'APPEND_MEMBER') {

			StructrModel.create(result[0], data.data.refId);

			StructrModel.callCallback(data.callback, result[0]);

		} else if (command.startsWith('APPEND_FILE')) {

			//StructrModel.create(result[0], data.data.refId);

		} else if (command === 'REMOVE') {

			let obj = StructrModel.obj(data.id);
			if (obj) {
				obj.remove();
			}

			StructrModel.callCallback(data.callback);

		} else if (command === 'REMOVE_CHILD') {

			let obj = StructrModel.obj(data.id);
			if (obj) {
				obj.remove(data.data.parentId);
			}

			StructrModel.callCallback(data.callback);

		} else if (command === 'CREATE' || command === 'ADD' || command === 'IMPORT') {

			for (let entity of result) {

				if (command === 'CREATE' && (entity.isPage || entity.isFolder || entity.isFile || entity.isImage || entity.isVideo || entity.isUser || entity.isGroup || entity.isWidget || entity.isResourceAccess)) {
					StructrModel.create(entity);
				} else {

					if (!entity.parent && _Pages.shadowPage && entity.pageId === _Pages.shadowPage.id) {

						entity = StructrModel.create(entity, null, false);
						let el = (entity.isContent || entity.type === 'Template') ? _Elements.appendContentElement(entity, _Pages.components, true) : _Pages.appendElementElement(entity, _Pages.components, true);

						if (Structr.isExpanded(entity.id)) {
							_Entities.ensureExpanded(el);
						}

						let synced = entity.syncedNodesIds;

						if (synced && synced.length) {

							// Change icon
							for (let syncedId of synced) {
								let syncedEl = Structr.node(syncedId);
								if (syncedEl && syncedEl.length) {
									let icon = entity.isContent ? _Elements.getContentIcon(entity) : _Elements.getElementIcon(entity);
									syncedEl.children('.typeIcon').attr('class', 'typeIcon ' + _Icons.getFullSpriteClass(icon));
									_Entities.removeExpandIcon(syncedEl);
								}
							}
						}
					}
				}

				if (command === 'CREATE' && entity.isPage && Structr.lastMenuEntry === _Pages._moduleName) {

					if (entity.createdBy === StructrWS.userId) {
						setTimeout(function () {
							_Pages.previews.showPreviewInIframeIfVisible(entity.id);
						}, 1000);
					}

				} else if (entity.pageId) {

					if (entity.id) {
						_Pages.previews.showPreviewInIframeIfVisible(entity.pageId, entity.id);
					} else {
						_Pages.previews.showPreviewInIframeIfVisible(entity.pageId);
					}
				}

				StructrModel.callCallback(data.callback, entity);
			}

		} else if (command === 'PROGRESS') {

			if (dialogMsg.is(':visible')) {
				let msgObj = JSON.parse(data.message);
				dialogMsg.html('<div class="infoBox info">' + msgObj.message + '</div>');
			}

		} else if (command === 'FINISHED') {

			StructrModel.callCallback(data.callback, data.data);

		} else if (command === 'AUTOCOMPLETE') {

			StructrModel.callCallback(data.callback, result);

		} else if (command === 'FIND_DUPLICATES') {

			StructrModel.callCallback(data.callback, result);

		} else if (command === 'SCHEMA_COMPILED') {

			_Schema.processSchemaRecompileNotification();

		} else if (command === 'GENERIC_MESSAGE') {

			Structr.handleGenericMessage(data.data);

		} else if (command === 'FILE_IMPORT') {

			StructrModel.callCallback(data.callback, result);

		} else if (command === 'GET_SUGGESTIONS') {

			StructrModel.callCallback(data.callback, result);

		} else if (command === 'SERVER_LOG') {

			StructrModel.callCallback(data.callback, result);

		} else if (command === 'SAVE_LOCAL_STORAGE') {

			StructrModel.callCallback(data.callback, result);

		} else if (command === 'APPEND_WIDGET') {

			StructrModel.callCallback(data.callback, result);

		} else {

			console.log('Received unknown command: ' + command);

			if (sessionValid === false) {
				StructrWS.user   = null;
				StructrWS.userId = null;
				clearMain();

				Structr.login();
			}
		}
	},

	sendObj: (obj, callback) => {

		if (callback) {
			obj.callback = uuid.v4();
			StructrModel.callbacks[obj.callback] = callback;
		}

		let t = JSON.stringify(obj);

		if (!t) {
			return false;
		}

		try {

			StructrWS.wsWorker.postMessage({
				type: 'server',
				message: t
			});

		} catch (exception) {
			// console.log('Error in send(): ' + exception);
		}
		return true;
	}
};