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
$(document).ready(function() {
	Structr.registerModule(_Files);
});

let _Files = {
	_moduleName: 'files',
	defaultFolderAttributes: 'id,name,type,owner,isFolder,path,visibleToPublicUsers,visibleToAuthenticatedUsers,ownerId,isMounted,parentId,foldersCount,filesCount',
	searchField: undefined,
	searchFieldClearIcon: undefined,
	currentWorkingDir: undefined,
	filesMain: undefined,
	fileTree: undefined,
	folderContents: undefined,
	fileUploadList: undefined,
	chunkSize: 1024 * 64,
	fileSizeLimit: 1024 * 1024 * 1024,
	activeFileId: undefined,
	currentEditor: undefined,
	fileContents: {},
	fileHasUnsavedChanges: {},
	displayingFavorites: false,
	selectedElements: [],
	folderPageSize: 10000,
	folderPage: 1,
	droppableArea: undefined,
	filesViewModeKey: 'structrFilesViewMode_' + location.port,
	filesLastOpenFolderKey: 'structrFilesLastOpenFolder_' + location.port,
	filesResizerLeftKey: 'structrFilesResizerLeftKey_' + location.port,
	// activeFileTabPrefix: 'activeFileTabPrefix' + location.port,

	getViewMode: () => {
		return LSWrapper.getItem(_Files.filesViewModeKey, 'list');
	},
	setViewMode: (viewMode) => {
		LSWrapper.setItem(_Files.filesViewModeKey, viewMode);
	},
	isViewModeActive: (viewMode) => {
		return (viewMode === _Files.getViewMode());
	},
	init: () => {

		_Files.setViewMode(_Files.getViewMode());

		Structr.makePagesMenuDroppable();
		Structr.adaptUiToAvailableFeatures();

		window.addEventListener('resize', _Files.resize);
	},
	resize: () => {
		if (Structr.isModuleActive(_Files)) {
			_Files.moveResizer();
			Structr.resize();
			$('div.xml-mapping').css({ height: dialogBox.height() - 118 });
		}
	},
	prevAnimFrameReqId_moveResizer: undefined,
	moveResizer: (left) => {

		// throttle
		Structr.requestAnimationFrameWrapper(_Files.prevAnimFrameReqId_moveResizer, () => {
			left = left || LSWrapper.getItem(_Files.filesResizerLeftKey) || 300;
			$('.column-resizer', _Files.filesMain).css({ left: left });

			_Files.fileTree.css({width: left - 14 + 'px'});
			$('#folder-contents-container').css({width: 'calc(100% - ' + (left + 14) + 'px)'});
		});
	},
	onload: function() {

		Structr.mainContainer.innerHTML = _Files.templates.main();

		_Files.init();

		Structr.updateMainHelpLink(Structr.getDocumentationURLForTopic('files'));

		_Files.filesMain      = $('#files-main');
		_Files.fileTree       = $('#file-tree');
		_Files.folderContents = $('#folder-contents');

		_Files.moveResizer();
		Structr.initVerticalSlider($('.column-resizer', _Files.filesMain), _Files.filesResizerLeftKey, 204, _Files.moveResizer);

		let initFunctionBar = async () => {

			let fileTypes   = await _Schema.getDerivedTypes('org.structr.dynamic.File', ['CsvFile']);
			let folderTypes = await _Schema.getDerivedTypes('org.structr.dynamic.Folder', ['Trash']);

			Structr.functionBar.innerHTML = _Files.templates.functions({ fileTypes: fileTypes, folderTypes: folderTypes });

			UISettings.showSettingsForCurrentModule();
			_Files.updateFunctionBarStatus();

			let fileTypeSelect   = document.querySelector('select#file-type');
			let addFileButton    = document.getElementById('add-file-button');
			let folderTypeSelect = document.querySelector('select#folder-type');
			let addFolderButton  = document.getElementById('add-folder-button');

			addFileButton.addEventListener('click', () => {
				Command.create({
					type: fileTypeSelect.value,
					size: 0,
					parentId: _Files.currentWorkingDir ? _Files.currentWorkingDir.id : null
				});
			});

			addFolderButton.addEventListener('click', () => {
				Command.create({
					type: folderTypeSelect.value,
					parentId: _Files.currentWorkingDir ? _Files.currentWorkingDir.id : null
				});
			});

			Structr.functionBar.querySelector('.mount_folder').addEventListener('click', _Files.openMountDialog);

			_Files.searchField = Structr.functionBar.querySelector('#files-search-box');

			_Files.searchFieldClearIcon = document.querySelector('.clearSearchIcon');
			_Files.searchFieldClearIcon.addEventListener('click', (e) => {
				_Files.clearSearch();
			});

			_Files.searchField.focus();

			_Files.searchField.addEventListener('keyup', (e) => {

				let searchString = _Files.searchField.value;

				if (searchString && searchString.length) {
					_Files.searchFieldClearIcon.style.display = 'block';
				}

				if (searchString && searchString.length && e.keyCode === 13) {

					_Files.fulltextSearch(searchString);

				} else if (e.keyCode === 27 || searchString === '') {
					_Files.clearSearch();
				}
			});
		};
		initFunctionBar(); // run async (do not await) so it can execute while jstree is initialized

		$.jstree.defaults.core.themes.dots      = false;
		$.jstree.defaults.dnd.inside_pos        = 'last';
		$.jstree.defaults.dnd.large_drop_target = true;

		_Files.fileTree.on('ready.jstree', function () {

			_TreeHelper.makeTreeElementDroppable(_Files.fileTree, 'root');
			_TreeHelper.makeTreeElementDroppable(_Files.fileTree, 'favorites');

			_Files.loadAndSetWorkingDir(function () {

				let lastOpenFolder = LSWrapper.getItem(_Files.filesLastOpenFolderKey);

				if (lastOpenFolder === 'favorites') {

					$('#favorites_anchor').click();

				} else if (_Files.currentWorkingDir) {

					_Files.deepOpen(_Files.currentWorkingDir);

				} else {

					let selectedNode = _Files.fileTree.jstree('get_selected');
					if (selectedNode.length === 0) {
						$('#root_anchor').click();
					}
				}
			});
		});

		_Files.fileTree.on('select_node.jstree', function (evt, data) {

			if (data.node.id === 'favorites') {

				_Files.displayFolderContents('favorites');

			} else {

				_Files.setWorkingDirectory(data.node.id);
				_Files.displayFolderContents(data.node.id, data.node.parent, data.node.original.path, data.node.parents);
			}
		});

		_TreeHelper.initTree(_Files.fileTree, _Files.treeInitFunction, 'structr-ui-filesystem');

		_Files.activateUpload();

		$(window).off('resize').resize(function () {
			_Files.resize();
		});

		Structr.unblockMenu(100);

		_Files.resize();
		Structr.adaptUiToAvailableFeatures();
	},
	getContextMenuElements: function (div, entity) {

		const isFile         = entity.isFile;
		let selectedElements = document.querySelectorAll('.node.selected');

		// there is a difference when right-clicking versus clicking the kebab icon
		let fileNode = div;
		if (fileNode.hasClass('icons-container')) {
			fileNode = div.closest('.node');
		} else if (!fileNode.hasClass('node')) {
			fileNode = div.find('.node');
		}

		if (!fileNode.hasClass('selected')) {
			for (let selNode of document.querySelectorAll('.node.selected')) {
				selNode.classList.remove('selected');
			}
			fileNode.addClass('selected');

			selectedElements = document.querySelectorAll('.node.selected');
		}

		let fileCount     = document.querySelectorAll('.node.file.selected').length;
		let isMultiSelect = selectedElements.length > 1;
		let elements      = [];
		let contentType   = entity.contentType || '';

		if (isFile) {

			if (entity.isImage && contentType !== 'text/svg' && !contentType.startsWith('image/svg')) {

				if (entity.isTemplate) {
					elements.push({
						icon: _Icons.getSvgIcon('pencil_edit'),
						name: 'Edit source',
						clickHandler: function () {
							_Files.editFile(entity);
							return false;
						}
					});
				} else {
					elements.push({
						icon: _Icons.getSvgIcon('pencil_edit'),
						name: 'Edit Image',
						clickHandler: function () {
							_Files.editImage(entity);
							return false;
						}
					});
				}

			} else if (fileCount === 1 && _Files.isMinificationTarget(entity)) {
				elements.push({
					name: 'Edit Minification',
					clickHandler: function () {
						_Minification.showMinificationDialog(entity);
						return false;
					}
				});

			} else {
				elements.push({
					icon: _Icons.getSvgIcon('pencil_edit'),
					name: 'Edit File' + ((fileCount > 1) ? 's' : ''),
					clickHandler: function () {
						_Files.editFile(entity);
						return false;
					}
				});
			}

			_Elements.appendContextMenuSeparator(elements);
		}

		elements.push({
			name: 'Basic',
			clickHandler: function() {
				_Entities.showProperties(entity, 'general');
				return false;
			}
		});

		elements.push({
			name: 'Properties',
			clickHandler: function() {
				_Entities.showProperties(entity, 'ui');
				return false;
			}
		});

		_Elements.appendContextMenuSeparator(elements);

		if (isFile) {

			if (_Files.displayingFavorites) {
				elements.push({
					icon: _Icons.getSvgIcon('favorite-star-remove'),
					name: 'Remove from Favorites',
					clickHandler: function () {

						for (let el of selectedElements) {
							let id = Structr.getId(el);

							Command.favorites('remove', id, () => {
								Structr.node(id).remove();
							});
						}
						return false;
					}
				});

			} else if (entity.isFavoritable) {

				elements.push({
					icon: _Icons.getSvgIcon('favorite-star'),
					name: 'Add to Favorites',
					clickHandler: function () {

						for (let el of selectedElements) {
							let obj = StructrModel.obj(Structr.getId(el));

							if (obj.isFavoritable) {
								Command.favorites('add', obj.id, () => {});
							}
						}

						return false;
					}
				});
			}

			if (fileCount === 1) {
				elements.push({
					name: 'Copy Download URL',
					clickHandler: () => {
						// do not make the click handler async because it would return a promise instead of the boolean

						(async () => {
							// fake the a element so we do not need to look up the server
							let a = document.createElement('a');
							let possiblyUpdatedEntity = StructrModel.obj(entity.id);
							a.href = `${Structr.getPrefixedRootUrl('')}${possiblyUpdatedEntity.path}`;
							await navigator.clipboard.writeText(a.href);
						})();

						return false;
					}
				});

				elements.push({
					name: 'Download File',
					icon: _Icons.getSvgIcon('download-icon'),
					clickHandler: () => {
						// do not make the click handler async because it would return a promise instead of the boolean

						let a = document.createElement('a');
						let possiblyUpdatedEntity = StructrModel.obj(entity.id);
						a.href = `${Structr.getPrefixedRootUrl('')}${possiblyUpdatedEntity.path}?filename=${possiblyUpdatedEntity.name}`;
						a.click();

						return false;
					}
				});
			}

			if (fileCount === 1 && _Files.isArchive(entity)) {
				elements.push({
					name: 'Unpack archive',
					clickHandler: function () {
						_Files.unpackArchive(entity);
						return false;
					}
				});
			}

			Structr.performModuleDependendAction(function () {
				if (fileCount === 1 && Structr.isModulePresent('csv') && Structr.isModulePresent('api-builder') && contentType === 'text/csv') {
					elements.push({
						// icon: '<i class="' + _Icons.getFullSpriteClass(_Icons.import_icon) + '"></i>',
						name: 'Import CSV',
						clickHandler: function () {
							Importer.importCSVDialog(entity, false);
							return false;
						}
					});
				}
			});

			Structr.performModuleDependendAction(function () {
				if (fileCount === 1 && Structr.isModulePresent('xml') && (contentType === 'text/xml' || contentType === 'application/xml')) {
					elements.push({
						// icon: '<i class="' + _Icons.getFullSpriteClass(_Icons.import_icon) + '"></i>',
						name: 'Import XML',
						clickHandler: function () {
							Importer.importXMLDialog(entity, false);
							return false;
						}
					});
				}
			});
		}

		if (!isMultiSelect) {

			_Elements.appendContextMenuSeparator(elements);

			_Elements.appendSecurityContextMenuItems(elements, entity, entity.isFolder);
		}

		_Elements.appendContextMenuSeparator(elements);

		elements.push({
			icon: _Icons.getSvgIcon('trashcan'),
			classes: ['menu-bolder', 'danger'],
			name: 'Delete ' + (isMultiSelect ? 'selected' : entity.type),
			clickHandler: () => {

				if (isMultiSelect) {

					let files = [];

					for (let el of selectedElements) {
						files.push(Structr.entityFromElement(el));
					}

					_Entities.deleteNodes(this, files, true, () => {
						_Files.refreshTree();
					});

				} else {

					_Entities.deleteNode(this, entity, true, () => {
						_Files.refreshTree();
					});
				}

				return false;
			}
		});

		_Elements.appendContextMenuSeparator(elements);

		return elements;
	},
	formatBytes(a, b= 2) {

		const sizes = ["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"];

		if (0 === a) return "0 " + sizes[0];

		const c = (0 > b) ? 0 : b;
		const d = Math.floor(Math.log(a) / Math.log(1024));

		return parseFloat((a/Math.pow(1024,d)).toFixed(c)) + " " + sizes[d]
	},
	deepOpen: function(d, dirs) {

		_TreeHelper.deepOpen(_Files.fileTree, d, dirs, 'parent', (_Files.currentWorkingDir ? _Files.currentWorkingDir.id : 'root'));

	},
	refreshTree: () => {

		let selectedId = _Files.fileTree.jstree('get_selected');

		_TreeHelper.refreshTree(_Files.fileTree, () => {
			_TreeHelper.makeTreeElementDroppable(_Files.fileTree, 'root');
			_TreeHelper.makeTreeElementDroppable(_Files.fileTree, 'favorites');

			_Files.fileTree.jstree('deselect_all');
			_Files.fileTree.jstree('activate_node', selectedId);
		});
	},
	refreshNode: function(nodeId, newName) {

		let node = _Files.fileTree.jstree('get_node', nodeId);
		node.text = newName;

		_TreeHelper.refreshNode(_Files.fileTree, node);
	},
	treeInitFunction: function(obj, callback) {

		switch (obj.id) {

			case '#':

				let defaultFilesystemEntries = [
					{
						id: 'favorites',
						text: 'Favorite Files',
						children: false,
						icon: _Icons.jstree_fake_icon,
						data: { svgIcon: _Icons.getSvgIcon('favorite-star', 18, 24) },
					},
					{
						id: 'root',
						text: '/',
						children: true,
						icon: _Icons.jstree_fake_icon,
						data: { svgIcon: _Icons.getSvgIcon('structr-s-small', 18, 24) },
						path: '/',
						state: {
							opened: true
						}
					}
				];

				callback(defaultFilesystemEntries);
				break;

			case 'root':
				_Files.load(null, callback);
				break;

			default:
				_Files.load(obj.id, callback);
				break;
		}

	},
	unload: function() {
		window.removeEventListener('resize', _Files.resize);
		fastRemoveAllChildren(Structr.mainContainer);
		fastRemoveAllChildren(Structr.functionBar);
	},
	activateUpload: () => {

		if (window.File && window.FileReader && window.FileList && window.Blob) {

			_Files.droppableArea = $('#folder-contents');

			_Files.droppableArea.on('dragover', function(event) {
				event.originalEvent.dataTransfer.dropEffect = 'copy';
				return false;
			});

			_Files.droppableArea.on('drop', function(event) {

				if (!event.originalEvent.dataTransfer) {
					return;
				}

				event.stopPropagation();
				event.preventDefault();

				if (_Files.displayingFavorites === true) {
					(new MessageBuilder()).warning("Can't upload to virtual folder Favorites - please first upload file to destination folder and then drag to favorites.").show();
					return;
				}

				_Files.fileUploadList = event.originalEvent.dataTransfer.files;
				let filesToUpload = [];
				let tooLargeFiles = [];

				$(_Files.fileUploadList).each(function(i, file) {
					if (file.size <= _Files.fileSizeLimit) {
						filesToUpload.push(file);
					} else {
						tooLargeFiles.push(file);
					}
				});

				if (filesToUpload.length < _Files.fileUploadList.length) {

					let errorText = 'The following files are too large (limit ' + _Files.fileSizeLimit / (1024 * 1024) + ' Mbytes):<br>\n';

					$(tooLargeFiles).each(function(i, tooLargeFile) {
						errorText += '<b>' + tooLargeFile.name + '</b>: ' + Math.round(tooLargeFile.size / (1024 * 1024)) + ' Mbytes<br>\n';
					});

					new MessageBuilder().error(errorText).title('File(s) too large for upload').requiresConfirmation().show();
				}

				filesToUpload.forEach(function(fileToUpload) {
					fileToUpload.parentId = _Files.currentWorkingDir ? _Files.currentWorkingDir.id : null;
					fileToUpload.hasParent = true; // Setting hasParent = true forces the backend to upload the file to the root dir even if parentId is null

					Command.createFile(fileToUpload, (createdFileNode) => {
						fileToUpload.id = createdFileNode.id;
						_Files.uploadFile(createdFileNode);
					});
				});

				return false;
			});
		}
	},
	uploadFile: function(file) {
		let worker = new Worker('js/upload-worker.js');
		worker.onmessage = function(e) {

			let binaryContent = e.data;
			let fileSize      = e.data.byteLength;
			let node          = Structr.node(file.id);
			node.find('.size').text(fileSize);

			let chunks = Math.ceil(fileSize / _Files.chunkSize);

			for (let c = 0; c < chunks; c++) {
				let start = c * _Files.chunkSize;
				let end = (c + 1) * _Files.chunkSize;
				let chunk = window.btoa(String.fromCharCode.apply(null, new Uint8Array(binaryContent.slice(start, end))));
				Command.chunk(file.id, c, _Files.chunkSize, chunk, chunks);
			}
		};

		$(_Files.fileUploadList).each(function(i, fileObj) {
			if (file.id === fileObj.id) {
				worker.postMessage(fileObj);
			}
		});
	},
	fulltextSearch: function(searchString) {

		let content = $('#folder-contents');
		content.children().hide();

		let url = Structr.rootUrl + 'files/ui?' + Structr.getRequestParameterName('loose') + '=1';

		for (let str of searchString.split(' ')) {
			url = url + '&indexedWords=' + str;
		}

		_Files.displaySearchResultsForURL(url, searchString);
	},
	clearSearch: function() {
		_Files.searchField.value = '';
		_Files.searchFieldClearIcon.style.display = 'none';
		$('#search-results').remove();
		$('#folder-contents').children().show();
	},
	loadAndSetWorkingDir: function(callback) {
		Command.rest("/me/ui", function (result) {
			let me = result[0];
			if (me.workingDirectory) {
				_Files.currentWorkingDir = me.workingDirectory;
			} else {
				_Files.currentWorkingDir = null;
			}

			callback();
		});
	},
	load: (id, callback) => {

		let displayFunction = (folders) => {

			let list = folders.map((d) => {
				return {
					id: d.id,
					text:  d.name || '[unnamed]',
					children: d.foldersCount > 0,
					icon: _Icons.jstree_fake_icon,
					data: { svgIcon: _Icons.getSvgIcon(_Icons.getFolderIconSVG(d), 16, 24) },
					path: d.path
				};
			});

			callback(list);

			_TreeHelper.makeDroppable(_Files.fileTree, list);
		};

		if (!id) {
			Command.list('Folder', true, _Files.folderPageSize, _Files.folderPage, 'name', 'asc', _Files.defaultFolderAttributes, displayFunction);
		} else {
			Command.query('Folder', _Files.folderPageSize, _Files.folderPage, 'name', 'asc', { parent: id }, displayFunction, true, 'public', _Files.defaultFolderAttributes);
		}
	},
	setWorkingDirectory: (id) => {

		if (id === 'root') {
			_Files.currentWorkingDir = null;
		} else {
			_Files.currentWorkingDir = { id: id };
		}

		fetch(Structr.rootUrl + 'me', {
			method: 'PUT',
			body: JSON.stringify({'workingDirectory': _Files.currentWorkingDir})
		})
	},
	registerFolderLinks: () => {

		$('.is-folder.file-icon', _Files.folderContents).off('click').on('click', function (e) {
			e.preventDefault();
			e.stopPropagation();

			let el = $(this);
			let targetId = el.data('targetId');

			let openTargetNode = () => {
				_Files.fileTree.jstree('open_node', targetId, () => {
					_Files.fileTree.jstree('activate_node', targetId);
				});
			};

			let parentId = el.data('parentId');

			if (!parentId || _Files.fileTree.jstree('is_open', parentId)) {
				openTargetNode();
			} else {
				_Files.fileTree.jstree('open_node', parentId, openTargetNode);
			}

		});
	},
	updateFunctionBarStatus: () => {

		let addFolderButton   = document.getElementById('add-folder-button');
		let addFileButton     = document.getElementById('add-file-button');
		let mountDialogButton = document.getElementById('mount-folder-dialog-button');

		if (_Files.displayingFavorites === true) {

			addFolderButton?.classList.add('disabled');
			addFileButton?.classList.add('disabled');
			mountDialogButton?.classList.add('disabled');

			addFolderButton?.setAttribute('disabled', 'disabled');
			addFileButton?.setAttribute('disabled', 'disabled');
			mountDialogButton?.setAttribute('disabled', 'disabled');

		} else {

			addFolderButton?.classList.remove('disabled');
			addFileButton?.classList.remove('disabled');
			mountDialogButton?.classList.remove('disabled');

			addFolderButton?.removeAttribute('disabled');
			addFileButton?.removeAttribute('disabled');
			mountDialogButton?.removeAttribute('disabled');
		}
	},
	displayFolderContents: (id, parentId, nodePath, parents) => {

		fastRemoveAllChildren(_Files.folderContents[0]);

		LSWrapper.setItem(_Files.filesLastOpenFolderKey, id);

		_Files.displayingFavorites = (id === 'favorites');
		let isRootFolder           = (id === 'root');
		let parentIsRoot           = (parentId === '#');

		_Files.updateFunctionBarStatus();
		_Files.insertLayoutSwitches(id, parentId, nodePath, parents);

		// store current folder id so we can filter slow requests
		_Files.folderContents.data('currentFolder', id);

		let handleChildren = (children) => {

			let currentFolder = _Files.folderContents.data('currentFolder');

			if (currentFolder === id) {

				if (children && children.length) {
					for (let child of children) {
						_Files.appendFileOrFolder(child);
					}
				}

				_Files.resize();
				_Files.registerFolderLinks();
			}
		};

		if (_Files.displayingFavorites === true) {

			$('#folder-contents-container > button').addClass('disabled').attr('disabled', 'disabled');

			_Files.folderContents.append(`<div class="folder-path truncate">${_Icons.getSvgIcon('favorite-star')} Favorite Files</div>`);

			if (_Files.isViewModeActive('list')) {

				_Files.folderContents.append(`
					<table id="files-table" class="stripe">
						<thead><tr><th class="icon">&nbsp;</th><th>Name</th><th></th><th>Size</th><th>Type</th><th>Owner</th></tr></thead>
						<tbody id="files-table-body">
						</tbody>
					</table>
				`);
			}

			fetch(Structr.rootUrl + 'me/favorites').then(async response => {
				if (response.ok) {
					let data = await response.json();
					handleChildren(data.result);
				}
			});

		} else {

			$('#folder-contents-container > button').removeClass('disabled').attr('disabled', null);

			Command.query('Folder', 1000, 1, 'name', 'asc', { parentId: (isRootFolder ? null : id) }, handleChildren, true, null, _Files.defaultFolderAttributes);

			let pagerId = 'filesystem-files';
			_Pager.initPager(pagerId, 'File', 1, 25, 'name', 'asc');
			_Pager.page['File'] = 1;

			let filterOptions = {
				parentId: (parentIsRoot ? '' : id),
				hasParent: (!parentIsRoot)
			};

			_Pager.initFilters(pagerId, 'File', filterOptions, ['parentId', 'hasParent', 'isThumbnail']);

			let filesPager = _Pager.addPager(pagerId, _Files.folderContents, false, 'File', 'public', handleChildren, null, 'id,name,type,contentType,isFile,isImage,isThumbnail,isFavoritable,isTemplate,tnSmall,tnMid,path,size,owner,visibleToPublicUsers,visibleToAuthenticatedUsers', undefined, true);

			filesPager.cleanupFunction = () => {
				let toRemove = $('.node.file', filesPager.el).closest( (_Files.isViewModeActive('list') ? 'tr' : '.tile') );

				for (let elem of toRemove) {
					fastRemoveAllChildren(elem);
					elem.remove();
				}
			};

			filesPager.appendFilterElements(`
				<span class="mr-1">Filter:</span>
				<input type="text" class="filter" data-attribute="name">
				<input type="text" class="filter" data-attribute="parentId" value="${(parentIsRoot ? '' : id)}" hidden>
				<input type="checkbox" class="filter" data-attribute="hasParent" ${(parentIsRoot ? '' : 'checked')} hidden>
			`);
			filesPager.activateFilterElements();
			filesPager.setIsPaused(false);
			filesPager.refresh();

			_Files.insertBreadCrumbNavigation(parents, nodePath, id);

			if (_Files.isViewModeActive('list')) {
				_Files.folderContents.append(`
					<table id="files-table" class="stripe">
						<thead><tr><th class="icon">&nbsp;</th><th>Name</th><th></th><th>Size</th><th>Type</th><th>Owner</th></tr></thead>
						<tbody id="files-table-body">
							${(!isRootFolder ? `<tr><td class="is-folder file-icon" data-target-id="${parentId}">${_Icons.getSvgIcon('folder-closed-icon', 16, 16)}</td><td><a href="#" class="folder-up">..</a></td><td></td><td></td><td></td></tr>` : '')}
						</tbody>
					</table>
				`);

			} else if (_Files.isViewModeActive('tiles')) {
				if (!isRootFolder) {
					_Files.folderContents.append(`<div class="tile"><div class="node folder"><div class="is-folder file-icon" data-target-id="${parentId}">${_Icons.getSvgIcon('folder-closed-icon', 16, 16)}</div><b title="..">..</b></div></div>`);
				}
			} else if (_Files.isViewModeActive('img')) {
				if (!isRootFolder) {
					_Files.folderContents.append(`<div class="tile img-tile"><div class="node folder"><div class="is-folder file-icon" data-target-id="${parentId}">${_Icons.getSvgIcon('folder-closed-icon', 16, 16)}</div><b title="..">..</b></div></div>`);
				}
			}
		}
	},
	insertBreadCrumbNavigation: (parents, nodePath, id) => {

		if (parents) {

			let preventOldFolderNameInBreadcrumbs = () => {
				let modelObj = StructrModel.obj(id);
				if (modelObj && modelObj.path) {
					nodePath = modelObj.path;
				}
			};
			preventOldFolderNameInBreadcrumbs();

			parents = [].concat(parents).reverse().slice(1);

			let pathNames = (nodePath === '/') ? ['/'] : [''].concat(nodePath.slice(1).split('/'));
			let path      = parents.map((parent, idx) => { return '<a class="breadcrumb-entry" data-folder-id="' + parent + '">' + pathNames[idx] + '/</a>'; }).join('') + pathNames.pop();

			_Files.folderContents.append('<div class="folder-path truncate">' + path + '</div>');

			$('.breadcrumb-entry').click(function (e) {
				e.preventDefault();

				$('#' + $(this).data('folderId') + '_anchor').click();
			});
		}
	},
	insertLayoutSwitches: function (id, parentId, nodePath, parents) {

		let checkmark = _Icons.getSvgIcon('checkmark_bold', 12, 12, 'icon-green mr-2');

		_Files.folderContents.prepend(`
			<div id="switches" class="absolute flex top-4 right-2">
				<button class="switch ${(_Files.isViewModeActive('list') ? 'active' : 'inactive')} inline-flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green" id="switch-list" data-view-mode="list">${(_Files.isViewModeActive('list') ? checkmark : '')} List</button>
				<button class="switch ${(_Files.isViewModeActive('tiles') ? 'active' : 'inactive')} inline-flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green" id="switch-tiles" data-view-mode="tiles">${(_Files.isViewModeActive('tiles') ? checkmark : '')} Tiles</button>
				<button class="switch ${(_Files.isViewModeActive('img') ? 'active' : 'inactive')} inline-flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green" id="switch-img" data-view-mode="img">${(_Files.isViewModeActive('img') ? checkmark : '')} Images</button>
			</div>
		`);

		let listSw  = $('#switch-list');
		let tilesSw = $('#switch-tiles');
		let imgSw   = $('#switch-img');

		let layoutSwitchFunction = function() {
			let state = $(this).hasClass('inactive');

			if (state) {
				let viewMode = $(this).data('viewMode');
				_Files.setViewMode(viewMode);

				_Entities.changeBooleanAttribute(listSw,  _Files.isViewModeActive('list'),  'List',   'List');
				_Entities.changeBooleanAttribute(tilesSw, _Files.isViewModeActive('tiles'), 'Tiles',  'Tiles');
				_Entities.changeBooleanAttribute(imgSw,   _Files.isViewModeActive('img'),   'Images', 'Images');

				_Files.displayFolderContents(id, parentId, nodePath, parents);
			}
		};

		listSw.on('click', layoutSwitchFunction);
		tilesSw.on('click', layoutSwitchFunction);
		imgSw.on('click', layoutSwitchFunction);
	},
	fileOrFolderCreationNotification: function (newFileOrFolder) {
		if ((_Files.currentWorkingDir === undefined || _Files.currentWorkingDir === null) && newFileOrFolder.parent === null) {
			_Files.appendFileOrFolder(newFileOrFolder);
		} else if ((_Files.currentWorkingDir !== undefined && _Files.currentWorkingDir !== null) && newFileOrFolder.parent && _Files.currentWorkingDir.id === newFileOrFolder.parent.id) {
			_Files.appendFileOrFolder(newFileOrFolder);
		}
	},
	appendFileOrFolder: function(d) {

		if (!d.isFile && !d.isFolder) return;

		StructrModel.createOrUpdateFromData(d, null, false);

		let size              = d.isFolder ? (d.foldersCount + d.filesCount) : d.size;
		let progressIndicator = `<div class="progress"><div class="bar"><div class="indicator"><span class="part"></span>/<span class="size">${size}</span></div></div></div>`;
		let name              = d.name || '[unnamed]';
		let fileIcon          = _Icons.getFileIconSVG(d);
		let listModeActive    = _Files.isViewModeActive('list');
		let tilesModeActive   = _Files.isViewModeActive('tiles');
		let imageModeActive   = _Files.isViewModeActive('img');
		let filePath          = `${Structr.getPrefixedRootUrl('')}${d.path}`;

		if (listModeActive) {

			let tableBody = $('#files-table-body');

			$('#row' + d.id, tableBody).remove();

			let rowId = 'row' + d.id;
			tableBody.append(`<tr id="${rowId}"${(d.isThumbnail ? ' class="thumbnail"' : '')}></tr>`);
			let row = $('#' + rowId);

			if (d.isFolder) {

				row.append(`
					<td class="is-folder file-icon" data-target-id="${d.id}" data-parent-id="${d.parentId}">${_Icons.getSvgIcon(_Icons.getFolderIconSVG(d), 16, 16)}</td>
					<td>
						<div id="id_${d.id}" class="node folder flex items-center justify-between">
							<b class="name_ leading-8 truncate">${name}</b>
							<div class="icons-container flex items-center"></div>
						</div>
					</td>
				`);

			} else {

				row.append(`
					<td class="file-icon"><a href="${filePath}" target="_blank">${fileIcon}</a></td>
					<td>
						<div id="id_${d.id}" class="node file flex items-center justify-between">
							<b class="name_ leading-8 truncate">${name}</b>
							<div class="icons-container flex items-center"></div>
							${progressIndicator}
						</div>
					</td>
				`);
			}

			row.append(`
				<td class="truncate id">${d.id}</td>
				<td class="size whitespace-nowrap">${d.isFolder ? size : _Files.formatBytes(size, 0)}</td>
				<td class="truncate">${d.type}${(d.isThumbnail ? ' thumbnail' : '')}${(d.isFile && d.contentType ? ` (${d.contentType})` : '')}</td>
				<td>${(d.owner ? (d.owner.name ? d.owner.name : '[unnamed]') : '')}</td>
			`);

			_Elements.enableContextMenuOnElement(row, d);

		} else if (tilesModeActive || imageModeActive) {

			let tileId = 'tile' + d.id;

			let tileClasses = ['tile'];
			if (d.isThumbnail)   { tileClasses.push('thumbnail'); }
			if (imageModeActive) { tileClasses.push('img-tile'); }

			_Files.folderContents.append(`<div id="${tileId}" class="${tileClasses.join(' ')}"></div>`);
			let tile = $('#' + tileId);

			if (d.isFolder) {

				tile.append(`
					<div id="id_${d.id}" class="node folder">
						<div class="is-folder file-icon" data-target-id="${d.id}" data-parent-id="${d.parentId}">${_Icons.getSvgIcon(_Icons.getFolderIconSVG(d), 48, 48)}</div>
						<b class="name_ abbr-ellipsis abbr-75pc">${name}</b>
						<div class="icons-container flex items-center"></div>
					</div>
				`);

			} else {

				let thumbnailProperty = (tilesModeActive ? 'tnSmall' : 'tnMid');
				let displayImagePath  = (d.isThumbnail) ? filePath : (d[thumbnailProperty]?.path ?? filePath);
				let iconOrThumbnail   = d.isImage ? `<img class="tn" src="${displayImagePath}">` : fileIcon;

				tile.append(`
					<div id="id_${d.id}" class="node file">
						<div class="file-icon"><a href="${filePath}" target="_blank">${iconOrThumbnail}</a></div>
						<b class="name_ abbr-ellipsis abbr-75pc">${name}</b>
						${progressIndicator}
						<div class="icons-container flex items-center"></div>
					</div>
				`);
			}

			_Elements.enableContextMenuOnElement(tile, d);
		}

		let div = Structr.node(d.id);

		if (!div || !div.length)
			return;

		_Entities.setMouseOver(div, true);

		let nameElement = div.children('b.name_');
		nameElement.attr('title', name);
		nameElement.off('click').on('click', (e) => {
			e.stopPropagation();
			_Entities.makeNameEditable(div);
		});

		div.on('remove', function() {
			div.closest('tr').remove();
		});

		if (d.isFolder) {
			_Files.handleFolder(div, d);
		} else {
			_Files.handleFile(div, d);
		}

		div.draggable({
			revert: 'invalid',
			containment: 'body',
			stack: '.jstree-node',
			appendTo: '#main',
			forceHelperSize: true,
			forcePlaceholderSize: true,
			distance: 5,
			cursorAt: { top: 8, left: 25 },
			zIndex: 99,
			stop: function(e, ui) {
				$(this).show();
				$(e.toElement).one('click', function(e) {
					e.stopImmediatePropagation();
				});
			},
			helper: function(event) {
				let helperEl = $(this);
				_Files.selectedElements = $('.node.selected');
				if (_Files.selectedElements.length > 1) {
					_Files.selectedElements.removeClass('selected');
					return $('<i class="node-helper ' + _Icons.getFullSpriteClass(_Icons.page_white_stack_icon) + '"></i>');
				}
				let hlp = helperEl.clone();
				hlp.find('.button').remove();
				return hlp;
			}
		});

		let iconsContainer = $('.icons-container', div);
		if (iconsContainer.length === 0) {
			_Entities.appendContextMenuIcon(div, d);
		} else {
			_Entities.appendContextMenuIcon(iconsContainer, d);
			_Entities.appendNewAccessControlIcon(iconsContainer, d, false);
		}

		if (d.isFile) {
			let dblclickHandler = (e) => {
				if ($('b.name_', div).length > 0) {
					_Files.editFile(d);
				}
			};

			if (div) {
				let node = div[0].closest('.node');
				node.removeEventListener('dblclick', dblclickHandler);
				node.addEventListener('dblclick', dblclickHandler);
			}
		}

		_Entities.makeSelectable(div);
	},
	handleFolder: function(div, d) {

		if (Structr.isModulePresent('cloud')) {
			div.append('<i title="Sync folder \'' + d.name + '\' to remote instance" class="push_icon button ' + _Icons.getFullSpriteClass(_Icons.push_file_icon) + '"></i>');
			div.children('.push_icon').on('click', function() {
				Structr.pushDialog(d.id, true);
				return false;
			});
		}

		div.droppable({
			accept: '.folder, .file, .image',
			greedy: true,
			hoverClass: 'nodeHover',
			tolerance: 'pointer',
			drop: function(e, ui) {

				e.preventDefault();
				e.stopPropagation();

				var self = $(this);
				var fileId = Structr.getId(ui.draggable);
				var folderId = Structr.getId(self);
				if (!(fileId === folderId)) {
					var nodeData = {};
					nodeData.id = fileId;

					if (_Files.selectedElements.length > 1) {

						$.each(_Files.selectedElements, function(i, fileEl) {
							var fileId = Structr.getId(fileEl);
							Command.setProperty(fileId, 'parentId', folderId, false, function() {
								$(ui.draggable).remove();
							});

						});
						_Files.selectedElements.length = 0;
					} else {
						Command.setProperty(fileId, 'parentId', folderId, false, function() {
							$(ui.draggable).remove();
						});
					}

					_Files.refreshTree();
				}

				return false;
			}
		});
	},
	handleFile: function(div, d) {

		if (Structr.isModulePresent('cloud') && !_Files.isViewModeActive('img')) {
			div.append('<i title="Sync file \'' + d.name + '\' to remote instance" class="push_icon button ' + _Icons.getFullSpriteClass(_Icons.push_file_icon) + '" />');
			div.children('.push_icon').on('click', function() {
				Structr.pushDialog(d.id, false);
				return false;
			});
		}
	},
	unpackArchive: (d) => {

		$('#tempInfoBox .infoHeading, #tempInfoBox .infoMsg').empty();
		$('#tempInfoBox .closeButton').hide();
		$('#tempInfoBox .infoMsg').append(`
			<div class="flex items-center justify-center">${_Icons.getSvgIcon('waiting-spinner', 24, 24, 'mr-2')}<div>Unpacking Archive - please stand by...</div></div>
			<p>Extraction will run in the background.<br>You can safely close this popup and work during this operation.<br>You will be notified when the extraction has finished.</p>
		`);

		$.blockUI({
			message: $('#tempInfoBox'),
			css: Structr.defaultBlockUICss
		});

		var closed = false;
		window.setTimeout(function() {
			$('#tempInfoBox .closeButton').show().on('click', function () {
				closed = true;
				$.unblockUI({
					fadeOut: 25
				});
			});
		}, 500);

		Command.unarchive(d.id, _Files.currentWorkingDir ? _Files.currentWorkingDir.id : undefined, function (data) {
			if (data.success === true) {
				_Files.refreshTree();
				let message = "Extraction of '" + data.filename + "' finished successfully. ";
				if (closed) {
					new MessageBuilder().success(message).requiresConfirmation("Close").show();
				} else {
					$('#tempInfoBox .infoMsg').html('<i class="' + _Icons.getFullSpriteClass(_Icons.accept_icon) + '"></i> ' + message);
				}

			} else {
				$('#tempInfoBox .infoMsg').html('<i class="' + _Icons.getFullSpriteClass(_Icons.error_icon) + '"></i> Extraction failed');
			}
		});
	},
	editImage: (image) => {

		Structr.dialog('' + image.name, function() {
			dialogMeta.show();
		}, function() {
			dialogMeta.show();
		});

		_Files.viewImage(image, $('#dialogBox .dialogText'));
	},
	viewImage: function(image, el) {
		dialogMeta.hide();

		let imagePath = `${Structr.getPrefixedRootUrl('')}${image.path}`;

		el.append(`
			<div class="image-editor-menubar">
				<div><i class="fa fa-crop"></i><br>Crop</div>
			</div>
			<div><img id="image-editor" class="orientation-' + image.orientation + '" src="${ imagePath }"></div>
		`);

		var x,y,w,h;

		dialogBtn.children('#saveFile').remove();
		dialogBtn.children('#saveAndClose').remove();

		dialogBtn.append('<button id="saveFile" disabled="disabled" class="disabled">Save</button>');
		dialogBtn.append('<button id="saveAndClose" disabled="disabled" class="disabled">Save and close</button>');

		dialogSaveButton = $('#saveFile', dialogBtn);
		saveAndClose = $('#saveAndClose', dialogBtn);

		$('button#saveFile', dialogBtn).on('click', function(e) {
			e.preventDefault();
			e.stopPropagation();
			Command.createConvertedImage(image.id, Math.round(w), Math.round(h), null, Math.round(x), Math.round(y), function() {
				dialogSaveButton.prop("disabled", true).addClass('disabled');
				saveAndClose.prop("disabled", true).addClass('disabled');
			});
		});

		saveAndClose.on('click', function(e) {
			e.stopPropagation();
			dialogSaveButton.click();
			setTimeout(function() {
				dialogSaveButton.remove();
				saveAndClose.remove();
				dialogCancelButton.click();
			}, 500);
		});

		$('.fa-crop', el).on('click', function() {

			$('#image-editor').cropper({
				crop: function(e) {

					x = e.x, y = e.y, w = e.width, h = e.height;

					dialogSaveButton.prop("disabled", false).removeClass('disabled');
					saveAndClose.prop("disabled", false).removeClass('disabled');
				}
			});
		});
	},
	editFile: (file) => {

		let parent = Structr.node(file.id);

		_Files.fileContents = {};

		_Files.selectedElements = $('.node.selected');
		if (_Files.selectedElements.length > 1 && parent.hasClass('selected')) {
			// _Files.selectedElements.removeClass('selected');
		} else {
			_Files.selectedElements = parent;
		}

		Structr.dialog('Edit files', function() {}, function() {}, ['popup-dialog-with-editor']);

		dialogText.append('<div id="files-tabs" class="files-tabs flex flex-col h-full"><ul></ul></div>');

		let filteredFileIds = [];
		if (_Files.selectedElements && _Files.selectedElements.length > 1 && parent.hasClass('selected')) {
			for (let el of _Files.selectedElements) {
				let modelObj = StructrModel.obj(Structr.getId(el));
				if (modelObj && !_Files.isMinificationTarget(modelObj) && modelObj.isFolder !== true) {
					filteredFileIds.push(modelObj.id);
				}
			}
		} else {
			let modelObj = StructrModel.obj(file.id);
			if (!modelObj) {
				modelObj = StructrModel.create(file);
			}
			if (modelObj && !_Files.isMinificationTarget(modelObj) && modelObj.isFolder !== true) {
				filteredFileIds.push(file.id);
			}
		}

		let filesTabs     = document.getElementById('files-tabs');
		let filesTabsUl   = filesTabs.querySelector('ul');
		let loadedEditors = 0;

		for (let uuid of filteredFileIds) {

			Command.get(uuid, 'id,name,contentType,isTemplate', (entity) => {

				loadedEditors++;

				let tab             = Structr.createSingleDOMElementFromHTML(`<li id="tab-${entity.id}" class="file-tab">${entity.name}</li>`);
				let editorContainer = Structr.createSingleDOMElementFromHTML(`<div id="content-tab-${entity.id}" class="content-tab-editor flex-grow flex"></div>`);

				filesTabsUl.appendChild(tab);
				filesTabs.appendChild(editorContainer);

				_Files.markFileEditorTabAsChanged(entity.id, _Files.fileHasUnsavedChanges[entity.id]);

				tab.addEventListener('click', (e) => {
					e.stopPropagation();

					// prevent activating the current tab
					if (!tab.classList.contains('active')) {

						// set all other tabs inactive and this one active
						for (let tab of filesTabsUl.querySelectorAll('li')) {
							tab.classList.remove('active');
						}
						tab.classList.add('active');

						// hide all editors and show this one
						for (let otherEditorContainer of filesTabs.querySelectorAll('div.content-tab-editor')) {
							otherEditorContainer.style.display = 'none';
						}
						editorContainer.style.display = 'block';

						// clear all other tabs before editing this one to ensure correct height
						for (let editor of filesTabs.querySelectorAll('.content-tab-editor')) {
							fastRemoveAllChildren(editor);
						}

						_Files.editFileWithMonaco(entity, $(editorContainer));
					}

					return false;
				});

				if (file.id === entity.id) {
					tab.click();
				}
			});
		}
	},
	markFileEditorTabAsChanged: (id, hasChanges) => {
		if (hasChanges) {
			$('#tab-' + id).addClass('has-changes');
		} else {
			$('#tab-' + id).removeClass('has-changes');
		}
	},
	editFileWithMonaco: async (file, element) => {

		// remove all buttons
		dialogBtn.children().remove();

		dialogBtn.html('<button class="closeButton">Close</button>');
		dialogBtn.append('<button id="saveFile" disabled="disabled" class="disabled">Save</button>');
		dialogBtn.append('<button id="saveAndClose" disabled="disabled" class="disabled">Save and close</button>');

		dialogCancelButton = $('.closeButton', dialogBox);
		dialogSaveButton   = $('#saveFile', dialogBtn);
		saveAndClose       = $('#saveAndClose', dialogBtn);

		element.append('<div class="editor h-full overflow-hidden"></div><div id="template-preview"><textarea readonly></textarea></div>');

		let urlForFileAndPreview = Structr.viewRootUrl + file.id + '?' + Structr.getRequestParameterName('edit') + '=1';
		let fileResponse         = await fetch(urlForFileAndPreview);
		let data                 = await fileResponse.text();
		let initialText          = _Files.fileContents[file.id] || data;

		let fileMonacoConfig = {
			value: initialText,
			language: _Files.getLanguageForFile(file),
			lint: true,
			autocomplete: true,
			changeFn: (editor, entity) => {
				let currentText = editor.getValue();

				// Store current editor text
				_Files.fileContents[file.id] = currentText;

				_Files.fileHasUnsavedChanges[file.id] = (data !== currentText);

				_Files.markFileEditorTabAsChanged(file.id, _Files.fileHasUnsavedChanges[file.id]);

				if (data === currentText) {
					dialogSaveButton.prop("disabled", true).addClass('disabled');
					saveAndClose.prop("disabled", true).addClass('disabled');
				} else {
					dialogSaveButton.prop("disabled", false).removeClass('disabled');
					saveAndClose.prop("disabled", false).removeClass('disabled');
				}
			}
		};

		dialogMeta.html('<span class="editor-info"></span>');

		let monacoEditor = _Editors.getMonacoEditor(file, 'content', element[0].querySelector('.editor'), fileMonacoConfig);

		_Editors.addEscapeKeyHandlersToPreventPopupClose(monacoEditor);

		let editorInfo = dialogMeta[0].querySelector('.editor-info');
		_Editors.appendEditorOptionsElement(editorInfo);
		let { isTemplateCheckbox, showPreviewCheckbox } = _Files.appendTemplateConfig(editorInfo, monacoEditor, file, element, urlForFileAndPreview);

		_Editors.resizeVisibleEditors();

		fileMonacoConfig.changeFn(monacoEditor);
		monacoEditor.focus();

		dialogSaveButton.on('click', function(e) {

			e.preventDefault();
			e.stopPropagation();

			let newText = monacoEditor.getValue();
			if (data === newText) {
				return;
			}

			// update current value so we can check against it
			data = newText;
			fileMonacoConfig.changeFn(monacoEditor);

			let saveFileAction = (callback) => {
				_Files.updateTextFile(file, newText, callback);
				initialText = newText;
				dialogSaveButton.prop("disabled", true).addClass('disabled');
				saveAndClose.prop("disabled", true).addClass('disabled');
			};

			if (isTemplateCheckbox.checked) {

				_Entities.setProperty(file.id, 'isTemplate', false, false, () => {
					saveFileAction(() => {
						_Entities.setProperty(file.id, 'isTemplate', true, false, () => {
							let active = showPreviewCheckbox.checked;
							if (active) {
								_Files.updateTemplatePreview(element, urlForFileAndPreview);
							}
						});
					});
				});

			} else {

				saveFileAction();
			}
		});

		let checkForUnsaved = () => {
			if ($('.file-tab.has-changes').length > 0) {
				return confirm('You have unsaved changes, really close without saving?');
			} else {
				return true;
			}
		};

		saveAndClose.on('click', function(e) {
			e.stopPropagation();
			dialogSaveButton.click();

			if (checkForUnsaved()) {
				setTimeout(function() {
					dialogSaveButton.remove();
					saveAndClose.remove();
					dialogCancelButton.click();
				}, 500);
			}
		});

		dialogCancelButton.on('click', (e) => {
			if (checkForUnsaved()) {
				e.stopPropagation();
				dialogText.empty();
				$.unblockUI({
					fadeOut: 25
				});

				dialogBtn.children(':not(.closeButton)').remove();

				Structr.focusSearchField();

				LSWrapper.removeItem(Structr.dialogDataKey);
			}
		});

		_Files.resize();
	},
	appendTemplateConfig: (element, editor, file, outerElement, urlForFileAndPreview) => {

		element.insertAdjacentHTML('beforeend', `
			<label for="isTemplate">Replace template expressions: <input id="isTemplate" type="checkbox" ${file.isTemplate ? 'checked' : ''}></label>
			<label for="showTemplatePreview">Show preview: <input id="showTemplatePreview" type="checkbox" ${file.isTemplate ? '' : 'disabled=disabled'}></label>
		`);

		let isTemplateCheckbox   = element.querySelector('#isTemplate');
		let showPreviewCheckbox  = element.querySelector('#showTemplatePreview');

		Structr.appendInfoTextToElement({
			text: "Expressions like <pre>Hello ${print(me.name)} !</pre> will be evaluated. To see a preview, tick the adjacent checkbox.",
			element: $(isTemplateCheckbox),
			insertAfter: true,
			css: {
				"margin-right": "4px"
			}
		});

		isTemplateCheckbox.addEventListener('change', () => {
			let active = isTemplateCheckbox.checked;
			_Entities.setProperty(file.id, 'isTemplate', active, false, function() {
				file.isTemplate = active;
				showPreviewCheckbox.disabled = !active;
			});
		});

		showPreviewCheckbox.addEventListener('change', () => {
			let active = showPreviewCheckbox.checked;
			if (active) {
				_Files.updateTemplatePreview(outerElement, urlForFileAndPreview);
			} else {
				let previewArea = $('#template-preview').hide();
				$('textarea', previewArea).val('');
				$('.editor', outerElement).width('inherit');
			}

			_Editors.resizeVisibleEditors();
		});

		return { isTemplateCheckbox, showPreviewCheckbox };
	},
	getLanguageForFile: (file) => {

		let language = file.contentType;

		if (language === 'application/javascript') {
			language = 'javascript';
		}

		if (!language) {
			if (file.name.endsWith('.css')) {
				language = 'css';
			} else if (file.name.endsWith('.js')) {
				language = 'javascript';
			} else {
				language = 'text';
			}
		}

		if (file.isTemplate) {
			language = 'javascript';
		}

		return language;
	},
	dialogSizeChanged: () => {
		_Editors.resizeVisibleEditors();
	},
	// appendCSVImportDialogIcon: function(parent, file) {
	//
	// 	parent.append(' <i class="import_icon button ' + _Icons.getFullSpriteClass(_Icons.import_icon) + '" title="Import this CSV file" />');
	// 	$('.import_icon', parent).on('click', function() {
	// 		Importer.importCSVDialog(file, false);
	// 		return false;
	// 	});
	// },
	// appendXMLImportDialogIcon: function(parent, file) {
	//
	// 	parent.append(' <i class="import_icon button ' + _Icons.getFullSpriteClass(_Icons.import_icon) + '" title="Import this XML file" />');
	// 	$('.import_icon', parent).on('click', function() {
	// 		Importer.importXMLDialog(file, false);
	// 		return false;
	// 	});
	// },
	displaySearchResultsForURL: async (url, searchString) => {

		let content = $('#folder-contents');
		$('#search-results').remove();
		content.append('<div id="search-results"></div>');

		let container = $('#search-results');

		let response = await fetch(url);

		if (response.ok) {
			let data = await response.json();

			if (!data.result || data.result.length === 0) {

				container.append('<h1>No results for "' + searchString + '"</h1>');
				container.append('<h2>Press ESC or click <a href="#filesystem" class="clear-results">here to clear</a> empty result list.</h2>');

				$('.clear-results', container).on('click', function() {
					_Files.clearSearch();
				});

			} else {

				container.append('<h1>' + data.result.length + ' result' + (data.result.length > 1 ? 's' : '') + ':</h1><table class="props"><thead><th class="_type">Type</th><th>Name</th><th>Size</th></thead><tbody></tbody></table>');
				container.append('<div id="search-results-details"></div>')

				let tbody = $('tbody', container);
				let detailsContainer = $('#search-results-details', container);

				for (let d of data.result) {

					tbody.append('<tr><td>' + _Icons.getFileIconSVG(d) + ' ' + d.type + (d.isFile && d.contentType ? ' (' + d.contentType + ')' : '') + '</td><td>' + d.name + '</td><td>' + d.size + '</td></tr>');

					let contextResponse = await fetch(Structr.rootUrl + 'files/' + d.id + '/getSearchContext', {
						method: 'POST',
						body: JSON.stringify({
							searchString: searchString,
							contextLength: 30
						})
					});

					if (contextResponse.ok) {

						let data = await contextResponse.json();

						if (data.result) {

							detailsContainer.append('<div class="search-result collapsed" id="results' + d.id + '"></div>');

							let div = $('#results' + d.id);

							div.append('<h2>' + _Icons.getFileIconSVG(d) + ' ' + d.name + '</h2>');
							div.append('<i class="toggle-height fa fa-expand"></i>').append('<i class="go-to-top fa fa-chevron-up"></i>');

							$('.toggle-height', div).on('click', function() {
								let icon = $(this);
								div.toggleClass('collapsed');
								icon.toggleClass('fa-expand');
								icon.toggleClass('fa-compress');
							});

							$('.go-to-top', div).on('click', function() {
								content.scrollTop(0);
							});

							for (let contextString of data.result.context) {

								for (let str of searchString.split(/[\s,;]/)) {
									contextString = contextString.replace(new RegExp('(' + str + ')', 'gi'), '<span class="highlight">$1</span>');
								}

								div.append('<div class="part">' + contextString + '</div>');
							}

							div.append('<div style="clear: both;"></div>');
						}
					}
				}
			}
		}
	},
	updateTextFile: function(file, text, callback) {
		if (text === "") {
			Command.chunk(file.id, 0, _Files.chunkSize, "", 1, callback);
		} else {
			var chunks = Math.ceil(text.length / _Files.chunkSize);
			for (var c = 0; c < chunks; c++) {
				var start = c * _Files.chunkSize;
				var end = (c + 1) * _Files.chunkSize;
				var chunk = utf8_to_b64(text.substring(start, end));
				Command.chunk(file.id, c, _Files.chunkSize, chunk, chunks, ((c+1 === chunks) ? callback : undefined));
			}
		}
	},
	updateTemplatePreview: async (element, url) => {

		let contentBox = $('.editor', element);
		contentBox.width('50%');

		let previewArea = $('#template-preview');
		previewArea.show();

		let response = await fetch(url.substr(0, url.indexOf('?')));
		let text     = await response.text();

		$('textarea', previewArea).val(text);
	},
	isArchive: function(file) {
		var contentType = file.contentType;
		var extension = file.name.substring(file.name.lastIndexOf('.') + 1);

		var archiveTypes = ['application/zip', 'application/x-tar', 'application/x-cpio', 'application/x-dump', 'application/x-java-archive', 'application/x-7z-compressed', 'application/x-ar', 'application/x-arj'];
		var archiveExtensions = ['zip', 'tar', 'cpio', 'dump', 'jar', '7z', 'ar', 'arj'];

		return isIn(contentType, archiveTypes) || isIn(extension, archiveExtensions);
	},
	isMinificationTarget: function(file) {
		let minifyTypes = [ 'MinifiedCssFile', 'MinifiedJavaScriptFile' ];
		return isIn(file.type, minifyTypes);
	},
	openMountDialog: function() {

		_Schema.getTypeInfo('Folder', function(typeInfo) {

			Structr.dialog('Mount Folder', function(){}, function(){});

			let elem = $(_Files.templates.mountDialog({typeInfo: typeInfo}));

			$('[data-info-text]', elem).each(function(i, el) {
				Structr.appendInfoTextToElement({
					element: $(el),
					text: $(el).data('info-text'),
					css: { marginLeft: "5px" }
				});
			});

			dialogText.append(elem);

			let mountButton = $('<button id="mount-folder" class="hover:bg-gray-100 focus:border-gray-666 active:border-green">Mount</button>').on('click', function() {

				var mountConfig = {};
				$('.mount-option[type="text"]').each(function(i, el) {
					var val = $(el).val();
					if (val !== "") {
						mountConfig[$(el).data('attributeName')] = val;
					}
				});
				$('.mount-option[type="number"]').each(function(i, el) {
					var val = $(el).val();
					if (val !== "") {
						mountConfig[$(el).data('attributeName')] = parseInt(val);
					}
				});
				$('.mount-option[type="checkbox"]').each(function(i, el) {
					mountConfig[$(el).data('attributeName')] = $(el).prop('checked');
				});

				if (!mountConfig.name) {
					Structr.showAndHideInfoBoxMessage('Must supply name', 'warning', 2000);
				} else if (!mountConfig.mountTarget) {
					Structr.showAndHideInfoBoxMessage('Must supply mount target', 'warning', 2000);
				} else {
					mountConfig.type = 'Folder';
					mountConfig.parentId = _Files.currentWorkingDir ? _Files.currentWorkingDir.id : null;
					Command.create(mountConfig);

					dialogCancelButton.click();
				}
			});

			dialogBtn.prepend(mountButton);
		});
	},

	templates: {
		main: config => `
			<link rel="stylesheet" type="text/css" media="screen" href="css/files.css">
			<link rel="stylesheet" type="text/css" media="screen" href="css/lib/cropper.min.css">
			
			
			<div class="tree-main" id="files-main">
			
				<div class="column-resizer"></div>
			
				<div class="tree-container" id="file-tree-container">
					<div class="tree" id="file-tree">
					</div>
				</div>
			
				<div class="tree-contents-container" id="folder-contents-container">
					<div class="tree-contents tree-contents-with-top-buttons" id="folder-contents">
					</div>
				</div>
			
			</div>
		`,
		functions: config => `
			<div id="files-action-buttons" class="flex-grow">
			
				<div class="inline-flex">
			
					<select class="select-create-type mr-2" id="folder-type">
						<option value="Folder">Folder</option>
						${config.folderTypes.map(type => '<option value="' + type + '">' + type + '</option>').join('')}
					</select>
			
					<button class="action button inline-flex items-center" id="add-folder-button">
						${_Icons.getSvgIcon('folder_add', 16, 16, ['mr-2'])}
						<span>Add</span>
					</button>
			
					<select class="select-create-type mr-2" id="file-type">
						<option value="File">File</option>
						${config.fileTypes.map(type => '<option value="' + type + '">' + type + '</option>').join('')}
					</select>
			
					<button class="action button inline-flex items-center" id="add-file-button">
						${_Icons.getSvgIcon('file_add', 16, 16, ['mr-2'])}
						<span>Add</span>
					</button>
			
					<button class="mount_folder button inline-flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green" id="mount-folder-dialog-button">
						${_Icons.getSvgIcon('folder-link-open-icon', 16, 16, ['mr-2'])}
						Mount Folder
					</button>
				</div>
			</div>
			
			<div class="searchBox module-dependend" data-structr-module="text-search">
				<input id="files-search-box" class="search" name="search" placeholder="Search...">
				<i class="clearSearchIcon ${_Icons.getFullSpriteClass(_Icons.grey_cross_icon)}"></i>
			</div>
		`,
		mountDialog: config => `
			<table id="mount-dialog" class="props">
				<tr>
					<td data-info-text="The name of the folder which will mount the target directory">Name</td>
					<td><input type="text" class="mount-option" data-attribute-name="name"></td>
				</tr>
				<tr>
					<td data-info-text="The absolute path of the local directory to mount">Mount Target</td>
					<td><input type="text" class="mount-option" data-attribute-name="mountTarget"></td>
				</tr>
				<tr>
					<td>Do Fulltext Indexing</td>
					<td><input type="checkbox" class="mount-option" data-attribute-name="mountDoFulltextIndexing"></td>
				</tr>
				<tr>
					<td data-info-text="The scan interval for repeated scans of this mount target">Scan Interval (s)</td>
					<td><input type="number" class="mount-option" data-attribute-name="mountScanInterval"></td>
				</tr>
				<tr>
					<td data-info-text="Folders encountered underneath this mounted folder are created with this type">Mount Target Folder Type</td>
					<td><input type="text" class="mount-option" data-attribute-name="mountTargetFolderType"></td>
				</tr>
				<tr>
					<td data-info-text="Files encountered underneath this mounted folder are created with this type">Mount Target File Type</td>
					<td><input type="text" class="mount-option" data-attribute-name="mountTargetFileType"></td>
				</tr>
				<tr>
					<td data-info-text="List of checksum types which are being automatically calculated on file creation.<br>Supported values are: crc32, md5, sha1, sha512">Enabled Checksums</td>
					<td><input type="text" class="mount-option" data-attribute-name="enabledChecksums"></td>
				</tr>
				<tr>
					<td data-info-text="Registers this path with a watch service (if supported by operating/file system)">Watch Folder Contents</td>
					<td><input type="checkbox" class="mount-option" data-attribute-name="mountWatchContents"></td>
				</tr>
			</table>
		`,
	}
};