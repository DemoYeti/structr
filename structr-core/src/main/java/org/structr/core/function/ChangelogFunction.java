/**
 * Copyright (C) 2010-2018 Structr GmbH
 *
 * This file is part of Structr <http://structr.org>.
 *
 * Structr is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Structr is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Structr.  If not, see <http://www.gnu.org/licenses/>.
 */
package org.structr.core.function;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.apache.commons.io.FileUtils;
import org.mozilla.javascript.NativeObject;
import org.mozilla.javascript.ScriptRuntime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.structr.api.config.Settings;
import org.structr.common.error.ArgumentCountException;
import org.structr.common.error.ArgumentNullException;
import org.structr.common.error.FrameworkException;
import org.structr.core.GraphObject;
import org.structr.core.GraphObjectMap;
import org.structr.core.app.App;
import org.structr.core.app.StructrApp;
import org.structr.core.entity.AbstractNode;
import org.structr.core.property.EndNodeProperty;
import org.structr.core.property.Property;
import org.structr.core.property.StringProperty;
import org.structr.schema.action.ActionContext;
import org.structr.schema.action.Function;

public class ChangelogFunction extends Function<Object, Object> {

	public static final String ERROR_MESSAGE_CHANGELOG = "Usage: ${changelog(entity[, resolve=false[, filterKey, filterValue...]])}. Example: ${changelog(current, false, 'verb', 'change', 'timeTo', now)}";
	public static final String ERROR_MESSAGE_CHANGELOG_JS = "Usage: ${{Structr.changelog(entity[, resolve=false[, filterObject]])}}. Example: ${{Structr.changelog(Structr.get('current', false, {verb:\"change\", timeTo: new Date()}))}}";

	private static final Logger logger = LoggerFactory.getLogger(ChangelogFunction.class.getName());

	// Properties for the changelog entries
	private static final Property<String>  changelog_verb                        = new StringProperty("verb");
	private static final Property<String>  changelog_time                        = new StringProperty("time");
	private static final Property<String>  changelog_userId                      = new StringProperty("userId");
	private static final Property<String>  changelog_userName                    = new StringProperty("userName");
	private static final Property<String>  changelog_target                      = new StringProperty("target");
	private static final Property<AbstractNode> changelog_targetObj              = new EndNodeProperty<>("targetObj");
	private static final Property<String>  changelog_rel                         = new StringProperty("rel");
	private static final Property<String>  changelog_relId                       = new StringProperty("relId");
	private static final Property<String>  changelog_relDir                      = new StringProperty("relDir");
	private static final Property<String>  changelog_key                         = new StringProperty("key");
	private static final Property<String>  changelog_prev                        = new StringProperty("prev");
	private static final Property<String>  changelog_val                         = new StringProperty("val");

	@Override
	public String getName() {
		return "changelog()";
	}

	@Override
	public Object apply(final ActionContext ctx, final Object caller, final Object[] sources) throws FrameworkException {

		try {

			assertArrayHasMinLengthAndAllElementsNotNull(sources, 1);

			if (!Settings.ChangelogEnabled.getValue()) {

				throw new IllegalArgumentException("changelog function used even though the changelog is disabled - please check your configuration. (This function might still return results if the changelog was enabled earlier.)");
			}

			if (sources[0] instanceof GraphObject) {

				final String changelog = getChangelogForGraphObject((GraphObject) sources[0]);

				if (changelog != null && !("".equals(changelog))) {

					final ChangelogFilter changelogFilter = new ChangelogFilter();

					if (sources.length >= 3 && sources[2] != null) {

						if (sources[2] instanceof NativeObject) {

							changelogFilter.processJavaScriptConfigurationObject((NativeObject) sources[2]);

						} else {

							final int maxLength = sources.length;

							for (int i = 2; (i + 2) <= maxLength; i += 2) {

								if (sources[i] != null && sources[i+1] != null) {
									changelogFilter.addFilterEntry(sources[i].toString(), sources[i+1]);
								}

							}

							if (maxLength % 2 == 1 && sources[maxLength-1] != null) {
								logger.warn("Ignoring dangling filterKey: {}", sources[maxLength-1]);
							}
						}
					}

					if (sources.length >= 2 && Boolean.TRUE.equals(sources[1])) {
						changelogFilter.setResolveTargets(true);
					}

					return changelogFilter.getFilteredChangelog(changelog);
				}

				return new ArrayList();

			} else {

				logger.warn("First parameter must be of type GraphObject: \"{}\"", sources[0]);
				return usage(ctx.isJavaScriptContext());
			}

		} catch (IOException ioex) {

			logger.error("Unable to create changelog file: {}", ioex.getMessage());
			return usage(ctx.isJavaScriptContext());

		} catch (ArgumentNullException pe) {

			// silently ignore null arguments
			return null;

		} catch (ArgumentCountException pe) {

			logParameterError(caller, sources, pe.getMessage(), ctx.isJavaScriptContext());
			return usage(ctx.isJavaScriptContext());

		} catch (IllegalArgumentException iae) {

			logger.warn(iae.getMessage());
			return usage(ctx.isJavaScriptContext());
		}
	}

	@Override
	public String usage(boolean inJavaScriptContext) {
		return (inJavaScriptContext ? ERROR_MESSAGE_CHANGELOG_JS : ERROR_MESSAGE_CHANGELOG);
	}

	@Override
	public String shortDescription() {
		return "Returns the changelog object";
	}

	private String getChangelogForGraphObject (final GraphObject obj) throws IOException {

		final String typeFolderName = obj.isNode() ? "n" : "r";

		java.io.File file = getChangeLogFileOnDisk(typeFolderName, obj.getUuid(), false);

		if (file.exists()) {

			return FileUtils.readFileToString(file, "utf-8");

		} else {

			return "";
		}
	}

	public static java.io.File getChangeLogFileOnDisk(final String typeFolderName, final String uuid, final boolean create) {

		final String changelogPath = Settings.ChangelogPath.getValue();
		final String uuidPath      = getDirectoryPath(uuid);
		final java.io.File file    = new java.io.File(changelogPath + java.io.File.separator + typeFolderName + java.io.File.separator + uuidPath + java.io.File.separator + uuid);

		// create parent directory tree
		file.getParentFile().mkdirs();

		// create file only if requested
		if (!file.exists() && create) {

			try {

				file.createNewFile();

			} catch (IOException ioex) {

				logger.error("Unable to create changelog file {}: {}", file, ioex.getMessage());
			}
		}

		return file;
	}

	static String getDirectoryPath(final String uuid) {

		return (uuid != null)
			? uuid.substring(0, 1) + "/" + uuid.substring(1, 2) + "/" + uuid.substring(2, 3) + "/" + uuid.substring(3, 4)
			: null;

	}

	private class ChangelogFilter {

		private final JsonParser _jsonParser = new JsonParser();
		private final Gson _gson = new GsonBuilder().disableHtmlEscaping().create();
		private final App _app = StructrApp.getInstance();

		private final ArrayList<String> _filterVerbs    = new ArrayList();
		private Long _filterTimeFrom                    = null;
		private Long _filterTimeTo                      = null;
		private final ArrayList<String> _filterUserId   = new ArrayList();
		private final ArrayList<String> _filterUserName = new ArrayList();
		private final ArrayList<String> _filterRelType  = new ArrayList();
		private String _filterRelDir                    = null;
		private final ArrayList<String> _filterTarget   = new ArrayList();
		private final ArrayList<String> _filterKey      = new ArrayList();

		private boolean _resolveTargets = false;
		private boolean _noFilterConfig = true;

		public void addFilterEntry (final String filterKey, final Object filterValue) {

			switch (filterKey) {
				case "verb":
					_filterVerbs.add(filterValue.toString());
					break;

				case "timeFrom":
					_filterTimeFrom = toLong(filterValue);
					break;

				case "timeTo":
					_filterTimeTo = toLong(filterValue);
					break;

				case "userId":
					_filterUserId.add(filterValue.toString());
					break;

				case "userName":
					_filterUserName.add(filterValue.toString());
					break;

				case "relType":
					_filterRelType.add(filterValue.toString());
					break;

				case "relDir":
					_filterRelDir = filterValue.toString();
					break;

				case "target":
					_filterTarget.add(filterValue.toString());
					break;

				case "key":
					_filterKey.add(filterValue.toString());
					break;

				default:
					logger.warn("Unknown filter key: {}", filterKey);
			}
		}

		public void processJavaScriptConfigurationObject(final NativeObject javascriptConfigObject) {

			assignStringsIfPresent(javascriptConfigObject.get("verb"), _filterVerbs);

			assignLongIfPresent(javascriptConfigObject.get("timeFrom"), _filterTimeFrom);
			assignLongIfPresent(javascriptConfigObject.get("timeTo"), _filterTimeTo);

			assignStringsIfPresent(javascriptConfigObject.get("userId"), _filterUserId);
			assignStringsIfPresent(javascriptConfigObject.get("userName"), _filterUserName);
			assignStringsIfPresent(javascriptConfigObject.get("relType"), _filterRelType);

			if (javascriptConfigObject.get("relDir") != null) {
				_filterRelDir = javascriptConfigObject.get("relDir").toString();
			}

			assignStringsIfPresent(javascriptConfigObject.get("target"), _filterTarget);
			assignStringsIfPresent(javascriptConfigObject.get("key"), _filterKey);

		}

		private void assignLongIfPresent (final Object possibleLong, Long targetLongReference) {

			if (possibleLong != null) {
				targetLongReference = new Double(ScriptRuntime.toNumber(possibleLong)).longValue();
			}
		}

		private void assignStringsIfPresent (final Object possibleListOrString, ArrayList<String> targetListReference) {

			if (possibleListOrString != null) {
				if (possibleListOrString instanceof List) {
					targetListReference.addAll((List)possibleListOrString);
				} else if (possibleListOrString instanceof String) {
					targetListReference.add((String)possibleListOrString);
				}
			}
		}

		public void setResolveTargets (final boolean resolve) {
			_resolveTargets = resolve;
		}

		public List getFilteredChangelog (final String changelog) throws FrameworkException {

			final List list = new ArrayList();

			_noFilterConfig = (
					_filterVerbs.isEmpty() && _filterTimeFrom == null && _filterTimeTo == null && _filterUserId.isEmpty() &&
					_filterUserName.isEmpty() && _filterRelType.isEmpty() && _filterRelDir == null && _filterTarget.isEmpty() && _filterKey.isEmpty()
			);

			for (final String entry : changelog.split("\n")) {

				final JsonObject jsonObj = _jsonParser.parse(entry).getAsJsonObject();
				final String verb = jsonObj.get("verb").getAsString();
				final long time = jsonObj.get("time").getAsLong();
				final String userId = jsonObj.get("userId").getAsString();
				final String userName = jsonObj.get("userName").getAsString();
				final String relType = (jsonObj.has("rel") ? jsonObj.get("rel").getAsString() : null);
				final String relId = (jsonObj.has("relId") ? jsonObj.get("relId").getAsString() : null);
				final String relDir = (jsonObj.has("relDir") ? jsonObj.get("relDir").getAsString() : null);
				final String target = (jsonObj.has("target") ? jsonObj.get("target").getAsString() : null);
				final String key = (jsonObj.has("key") ? jsonObj.get("key").getAsString() : null);

				if (doesFilterApply(verb, time, userId, userName, relType, relDir, target, key)) {

					final GraphObjectMap obj = new GraphObjectMap();

					obj.put(changelog_verb, verb);
					obj.put(changelog_time, time);
					obj.put(changelog_userId, userId);
					obj.put(changelog_userName, userName);

					switch (verb) {
						case "create":
						case "delete":
							obj.put(changelog_target, target);
							if (_resolveTargets) {
								obj.put(changelog_targetObj, _app.getNodeById(target));
							}
							list.add(obj);
							break;

						case "link":
						case "unlink":
							obj.put(changelog_rel, relType);
							obj.put(changelog_relId, relId);
							obj.put(changelog_relDir, relDir);
							obj.put(changelog_target, target);
							if (_resolveTargets) {
								obj.put(changelog_targetObj, _app.getNodeById(target));
							}
							list.add(obj);
							break;

						case "change":
							obj.put(changelog_key, key);
							obj.put(changelog_prev, _gson.toJson(jsonObj.get("prev")));
							obj.put(changelog_val, _gson.toJson(jsonObj.get("val")));
							list.add(obj);
							break;

						default:
							logger.warn("Unknown verb in changelog: \"{}\"", verb);
							break;
					}

				}

			}

			return list;
		}

		public boolean doesFilterApply (final String verb, final long time, final String userId, final String userName, final String relType, final String relDir, final String target, final String key) {

			return (
				(_noFilterConfig == true) ||
				(
					(_filterVerbs.isEmpty()    || _filterVerbs.contains(verb)       ) &&
					(_filterTimeFrom == null   || _filterTimeFrom <= time           ) &&
					(_filterTimeTo == null     || _filterTimeTo >= time             ) &&
					(_filterUserId.isEmpty()   || _filterUserId.contains(userId)    ) &&
					(_filterUserName.isEmpty() || _filterUserName.contains(userName)) &&
					(_filterRelType.isEmpty()  || _filterRelType.contains(relType)  ) &&
					(_filterRelDir == null     || _filterRelDir.equals(relDir)      ) &&
					(_filterTarget.isEmpty()   || _filterTarget.contains(target)    ) &&
					(_filterKey.isEmpty()      || _filterKey.contains(key)          )
				)
			);
		}

		private Long toLong (final Object possibleLong) {

			if (possibleLong instanceof Date) {

				return ((Date)possibleLong).getTime();

			} else if (possibleLong instanceof Number) {

				return ((Number)possibleLong).longValue();

			} else {

				try {
					// parse with format from IS
					return (new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ").parse(possibleLong.toString())).getTime();

				} catch (ParseException ignore) {
					// silently fail as this can be any string
				}
			}

			logger.warn("Cannot convert object to long: {}", possibleLong);

			return null;
		}
	}
}
