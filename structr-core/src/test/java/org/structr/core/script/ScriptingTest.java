package org.structr.core.script;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import static junit.framework.TestCase.assertEquals;
import org.structr.common.StructrTest;
import org.structr.common.error.FrameworkException;
import org.structr.core.entity.TestOne;
import org.structr.core.graph.Tx;
import org.structr.schema.action.ActionContext;

/**
 *
 * @author Christian Morgner
 */
public class ScriptingTest extends StructrTest {

	public void testExtractScripts() {

		testExtraction("${function test() { return 'blah'; } return test();}");
		testExtraction("${function test() { return '{' + \"{\"; } return test();}");
		testExtraction("${function test() {{{ return '{' + \"{\" + '}'; }}} return test();}");

		// test multiple sources directly after each other
		final List<String> scripts = Scripting.extractScripts("${this.aString}${upper(true)}${lower(false)}");
		assertEquals("Invalid script extraction result", "${this.aString}", scripts.get(0));
		assertEquals("Invalid script extraction result", "${upper(true)}", scripts.get(1));
		assertEquals("Invalid script extraction result", "${lower(false)}", scripts.get(2));

	}

	public void testJavascript() {

		try (final Tx tx = app.tx()) {

			final ActionContext actionContext = new ActionContext();
			final TestOne test                = createTestNode(TestOne.class);

			test.setProperty(TestOne.anInt             , 1);
			test.setProperty(TestOne.aLong             , 2L);
			test.setProperty(TestOne.aDouble           , 3.0);
			test.setProperty(TestOne.aDate             , new Date());
			test.setProperty(TestOne.anEnum            , TestOne.Status.One);
			test.setProperty(TestOne.aString           , "täst");
			test.setProperty(TestOne.aBoolean          , true);
			test.setProperty(TestOne.anotherString     , "oneTwoThree${{{");
			test.setProperty(TestOne.stringWithQuotes  , "''\"\"''");

			assertEquals("Invalid JavaScript evaluation result", "test", Scripting.replaceVariables(securityContext, test, actionContext, "${ 'test' }"));
			assertEquals("Invalid JavaScript evaluation result", "1", Scripting.replaceVariables(securityContext, test, actionContext, "${ Structr.get('this').anInt; }"));
			assertEquals("Invalid JavaScript evaluation result", "2", Scripting.replaceVariables(securityContext, test, actionContext, "${ Structr.get('this').aLong; }"));
			assertEquals("Invalid JavaScript evaluation result", "3.0", Scripting.replaceVariables(securityContext, test, actionContext, "${ Structr.get('this').aDouble; }"));

			tx.success();

		} catch (FrameworkException fex) {

			fex.printStackTrace();
			fail("Unexpected exception.");
		}
	}

	private void testExtraction(final String source) {

		final List<String> scripts = Scripting.extractScripts(source);
		assertEquals("Invalid script extraction result", source, scripts.get(0));
	}

	@Override
	public void setUp() throws Exception {

		final Map<String, Object> config = new HashMap<>();

		// set scripting engine to rhino
		config.put("scripting.engine", "rhino");

		// call super with additional config
		super.setUp(config);
	}
}
