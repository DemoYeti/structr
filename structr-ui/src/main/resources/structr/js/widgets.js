/*
 *  Copyright (C) 2010-2013 Axel Morgner, structr <structr@structr.org>
 *
 *  This file is part of structr <http://structr.org>.
 *
 *  structr is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  structr is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with structr.  If not, see <http://www.gnu.org/licenses/>.
 */

var widgets, remoteWidgets, widgetsUrl = 'http://widgets.structr.org/structr/rest/widgets';
var win = $(window);

$(document).ready(function() {
    Structr.registerModule('widgets', _Widgets);
    Structr.classes.push('widget');
    _Widgets.resize();
    win.resize(function() {
        _Widgets.resize();
    });
});

var _Widgets = {

    icon : 'icon/layout.png',
    add_widget_icon : 'icon/layout_add.png',
    delete_widget_icon : 'icon/layout_delete.png',
	
    init : function() {

        Structr.initPager('Widget', 1, 25);
        
    },

    resize : function() {

        var windowWidth = win.width();
        var windowHeight = win.height();
        var headerOffsetHeight = 82;

        if (widgets) {
            widgets.css({
                width: Math.max(180, Math.min(windowWidth/3, 360)) + 'px',
                height: windowHeight - headerOffsetHeight + 'px'
            });
        }

    },

    onload : function() {
        
        _Widgets.init();
        
        log('onload');

        main.append('<div id="dropArea"><div class="fit-to-height" id="widgets"></div><div class="fit-to-height" id="remoteWidgets"></div></div>');
        widgets = $('#widgets');
        remoteWidgets = $('#remoteWidgets');
        
        _Widgets.refreshWidgets();
        _Widgets.refreshRemoteWidgets();
    },

    unload : function() {
        $(main.children('table')).remove();
    },

    refreshWidgets : function() {
        widgets.empty();
        widgets.append('<h2>Local Widgets</h2>');
        widgets.append('<button class="add_widgets_icon button"><img title="Add Widget" alt="Add Widget" src="' + _Widgets.add_widget_icon + '"> Add Widget</button>');
        $('.add_widgets_icon', main).on('click', function(e) {
            e.stopPropagation();
            Command.create({'type':'Widget'});
        });
        Structr.addPager(widgets, true, 'Widget');
        _Widgets.resize();
    },

    refreshRemoteWidgets : function() {
        remoteWidgets.empty();
        remoteWidgets.append('<h2>Remote Widgets</h2>');
        
        if (widgetsUrl.startsWith(document.location.hostname)) {
            return;
        }
        
        _Widgets.getRemoteWidgets(widgetsUrl, function(entity) {
            
            var obj = StructrModel.create(entity, undefined, false);
            obj.srcUrl = widgetsUrl + '/' + entity.id;
            _Widgets.appendWidgetElement(obj, true);
            
        });
        
        //remoteWidgets.append('<input id="widgetServerUrl" type="text" size="40" placeholder="Remote URL" value="http://server2.morgner.de:8084/structr/rest/widgets"><button id="connect_button">Connect</button>');
//        $('#connect_button', main).on('click', function(e) {
//            e.stopPropagation();
            
//        });
    },

    getRemoteWidgets : function(baseUrl, callback) {
        $.ajax({
            //url: $('#widgetServerUrl').val(),
            url: baseUrl,
            type: 'GET',
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            //async: false,
            statusCode : {
                200 : function(data) {
                    if (callback) {
                        $.each(data.result, function(i, entity) {
                            callback(entity);
                        });
                    }
                },
                400 : function(data, status, xhr) {
                    console.log(data, status, xhr);
                },
                401 : function(data, status, xhr) {
                    console.log(data, status, xhr);
                },
                403 : function(data, status, xhr) {
                    console.log(data, status, xhr);
                },
                404 : function(data, status, xhr) {
                    console.log(data, status, xhr);
                },
                422 : function(data, status, xhr) {
                    console.log(data, status, xhr);
                },
                500 : function(data, status, xhr) {
                    console.log(data, status, xhr);
                }
            }

        });
        
    },

    getIcon : function() {
        var icon = _Widgets.icon; // default
        return icon;
    },

    appendWidgetElement : function(widget, remote, el) {

        log('Widgets.appendWidgetElement', widget, remote);
        
        var icon = _Widgets.getIcon(widget);
        var parent = el ? el : (remote ? remoteWidgets : widgets);
        
        var delIcon, newDelIcon;
        var div = Structr.node(widget.id);
        if (div && div.length) {
            
            var formerParent = div.parent();
            
            if (!Structr.containsNodes(formerParent)) {
                _Entities.removeExpandIcon(formerParent);
                enable($('.delete_icon', formerParent)[0]);
            }            
            
        } else {
        
            parent.append('<div id="id_' + widget.id + '" class="node widget">'
                + '<img class="typeIcon" src="'+ icon + '">'
                + '<b title="' + widget.name + '" class="name_">' + fitStringToWidth(widget.name, 200) + '</b> <span class="id">' + widget.id + '</span>'
                + '</div>');
            div = Structr.node(widget.id);
            
        }
        
        if (!div) return;

        if (!remote) {
            _Entities.appendAccessControlIcon(div, widget);

            delIcon = div.children('.delete_icon');

            newDelIcon = '<img title="Delete file ' + widget.name + '\'" alt="Delete file \'' + widget.name + '\'" class="delete_icon button" src="' + Structr.delete_icon + '">';
            div.append(newDelIcon);
            delIcon = div.children('.delete_icon');
            div.children('.delete_icon').on('click', function(e) {
                e.stopPropagation();
                _Entities.deleteNode(this, widget);
            });

        }
		
        div.draggable({
            iframeFix: true,
            revert: 'invalid',
            containment: 'body',
            helper: 'clone',
            appendTo: '#main',
            stack: '.node',
            zIndex: 99,
            stop : function(e,ui) {
                $('#pages_').droppable('enable').removeClass('nodeHover');
            }
        });

        div.append('<img title="Edit widget" alt="Edit widget ' + widget.id + '" class="edit_icon button" src="icon/pencil.png">');
        $('.edit_icon', div).on('click', function(e) {
            e.stopPropagation();
            var text = widget.source || '';
            Structr.dialog('Edit widget "' + widget.name + '"', function() {
                log('Widget source saved')
            }, function() {
                log('cancelled')
            });
            _Widgets.editWidget(this, widget, text, dialogText);
        });
        
        if (!remote) {
            _Entities.appendEditPropertiesIcon(div, widget);
        }

        _Entities.setMouseOver(div, false);
        if (remote) {
            div.children('b.name_').off('click').css({ cursor:'move'});
        }

//        div.append('<div class="preview"></div>');
//        //$('.preview', div).contents().find('body').html('<html><head><title>' +  widget.name + '</title></head><body>' + widget.source + '</body></html>');
//        widget.pictures.forEach(function(pic) {
//            $('.preview', div).append('<img src="/' + pic.id + '">');
//        });

        return div;
    },

    editWidget : function (button, entity, text, element) {
        if (isDisabled(button)) return;
        var div = element.append('<div class="editor"></div>');
        log(div);
        var contentBox = $('.editor', element);
        editor = CodeMirror(contentBox.get(0), {
            value: unescapeTags(text),
            mode:  'text/html',
            lineNumbers: true
        });
        editor.focus();
        Structr.resize();

        dialogBtn.append('<button id="editorSave" disabled="disabled" class="disabled">Save Widget</button>');
        dialogBtn.append('<button id="saveAndClose" disabled="disabled" class="disabled"> Save and close</button>');

        dialogSaveButton = $('#editorSave', dialogBtn);
        var saveAndClose = $('#saveAndClose', dialogBtn);
        
        text1 = text;
        
        editor.on('change', function(cm, change) {
            
            text2 = editor.getValue();

            if (text1 === text2) {
                dialogSaveButton.prop("disabled", true).addClass('disabled');
                saveAndClose.prop("disabled", true).addClass('disabled');
            } else {
                dialogSaveButton.prop("disabled", false).removeClass('disabled');
                saveAndClose.prop("disabled", false).removeClass('disabled');
            }
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

        dialogSaveButton.on('click', function() {

            var newText = editor.getValue();

            if (text1 === newText) {
                return;
            }
            
            if (entity.srcUrl) {
                var data = JSON.stringify({'source':newText});
                log('update remote widget', entity.srcUrl, data);
                $.ajax({
                    //url: $('#widgetServerUrl').val(),
                    url: entity.srcUrl,
                    type: 'PUT',
                    dataType: 'json',
                    data: data,
                    contentType: 'application/json; charset=utf-8',
                    //async: false,
                    statusCode : {
                        200 : function(data) {
                            dialogMsg.html('<div class="infoBox success">Widget source saved.</div>');
                            $('.infoBox', dialogMsg).delay(2000).fadeOut(200);
                            text1 = newText;
                            dialogSaveButton.prop("disabled", true).addClass('disabled');
                            saveAndClose.prop("disabled", true).addClass('disabled');
                            
                        },
                        400 : function(data, status, xhr) {
                            console.log(data, status, xhr);
                        },
                        401 : function(data, status, xhr) {
                            console.log(data, status, xhr);
                        },
                        403 : function(data, status, xhr) {
                            console.log(data, status, xhr);
                        },
                        404 : function(data, status, xhr) {
                            console.log(data, status, xhr);
                        },
                        422 : function(data, status, xhr) {
                            console.log(data, status, xhr);
                        },
                        500 : function(data, status, xhr) {
                            console.log(data, status, xhr);
                        }
                    }

                });
                
            } else {
                
                Command.setProperty(entity.id, 'source', newText, false, function() {
                    dialogMsg.html('<div class="infoBox success">Widget saved.</div>');
                    $('.infoBox', dialogMsg).delay(2000).fadeOut(200);
                    text1 = newText;
                    dialogSaveButton.prop("disabled", true).addClass('disabled');
                    saveAndClose.prop("disabled", true).addClass('disabled');
                });

            }
            
        });
        
        editor.id = entity.id;
    }
};
